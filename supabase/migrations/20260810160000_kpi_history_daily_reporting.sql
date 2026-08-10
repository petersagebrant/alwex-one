-- Migration: extend kpi_history for safe daily KPI reporting
--
-- Unique daily report choice:
--   UNIQUE (kpi_id, report_date) on public.kpi_history.
--   PostgreSQL treats NULL as distinct in UNIQUE constraints, so ordinary
--   audit/history rows may keep report_date NULL (multiple per day allowed).
--   Daily reports always set report_date and therefore get one row per
--   (kpi_id, calendar day).
--
-- Duplicate handling (existing data):
--   Backfill report_date from recorded_at in Europe/Stockholm.
--   If multiple rows share the same (kpi_id, report_date), keep the latest
--   (by recorded_at, then created_at, then id) as the unique daily row and
--   clear report_date on older duplicates. No rows are deleted.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.kpi_history
  add column report_date date,
  add column recorded_by uuid references auth.users (id) on delete set null,
  add column updated_at timestamptz;

comment on column public.kpi_history.report_date is
  'Calendar date (Europe/Stockholm intent) for ordinary daily reports. NULL = non-daily / historical duplicate.';

comment on column public.kpi_history.recorded_by is
  'Auth user who recorded the entry; NULL for automated/system writes.';

comment on column public.kpi_history.updated_at is
  'Last update timestamp for the history row.';

-- Backfill updated_at before enforcing NOT NULL
update public.kpi_history
set updated_at = coalesce(created_at, recorded_at, now())
where updated_at is null;

alter table public.kpi_history
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- Backfill report_date from Stockholm calendar date of recorded_at
update public.kpi_history
set report_date = (recorded_at at time zone 'Europe/Stockholm')::date
where report_date is null;

-- Keep latest row per (kpi_id, report_date); clear report_date on older duplicates
with ranked as (
  select
    id,
    row_number() over (
      partition by kpi_id, report_date
      order by recorded_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.kpi_history
  where report_date is not null
)
update public.kpi_history as h
set report_date = null
from ranked as r
where h.id = r.id
  and r.rn > 1;

-- One ordinary daily report per KPI per calendar day
alter table public.kpi_history
  add constraint kpi_history_kpi_id_report_date_key
  unique (kpi_id, report_date);

create index kpi_history_report_date_idx
  on public.kpi_history (report_date desc);

create index kpi_history_recorded_by_idx
  on public.kpi_history (recorded_by);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_kpi_history_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists kpi_history_set_updated_at on public.kpi_history;

create trigger kpi_history_set_updated_at
  before update on public.kpi_history
  for each row
  execute function public.set_kpi_history_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: upserts need UPDATE
-- ---------------------------------------------------------------------------

drop policy if exists "Role: update kpi_history" on public.kpi_history;

create policy "Role: update kpi_history"
  on public.kpi_history
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.kpis k
      where k.id = kpi_history.kpi_id
        and public.can_write_operational(k.business_area_id)
    )
  )
  with check (
    exists (
      select 1
      from public.kpis k
      where k.id = kpi_history.kpi_id
        and public.can_write_operational(k.business_area_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Atomic daily report: history upsert + sync current KPI
-- ---------------------------------------------------------------------------

create or replace function public.upsert_daily_kpi_report(
  p_kpi_id uuid,
  p_report_date date,
  p_value text,
  p_status text,
  p_comment text default null,
  p_recorded_by uuid default null
)
returns public.kpi_history
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.kpi_history;
  v_recorded_at timestamptz;
  v_value text;
  v_actor uuid;
begin
  if p_kpi_id is null then
    raise exception 'kpi_id is required';
  end if;

  if p_report_date is null then
    raise exception 'report_date is required';
  end if;

  v_value := btrim(coalesce(p_value, ''));
  if v_value = '' then
    raise exception 'value is required';
  end if;

  if p_status is null or p_status not in ('Grön', 'Gul', 'Röd') then
    raise exception 'invalid status';
  end if;

  v_actor := coalesce(p_recorded_by, auth.uid());

  -- Stable midday timestamp in Europe/Stockholm for the report calendar day
  v_recorded_at :=
    ((p_report_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

  insert into public.kpi_history (
    kpi_id,
    value,
    status,
    comment,
    recorded_at,
    report_date,
    recorded_by
  )
  values (
    p_kpi_id,
    v_value,
    p_status,
    nullif(btrim(coalesce(p_comment, '')), ''),
    v_recorded_at,
    p_report_date,
    v_actor
  )
  on conflict (kpi_id, report_date)
  do update set
    value = excluded.value,
    status = excluded.status,
    comment = excluded.comment,
    recorded_at = excluded.recorded_at,
    recorded_by = coalesce(excluded.recorded_by, public.kpi_history.recorded_by),
    updated_at = now()
  returning * into v_row;

  update public.kpis
  set
    current_value = v_row.value,
    status = v_row.status,
    updated_at = now()
  where id = p_kpi_id;

  if not found then
    raise exception 'KPI not found: %', p_kpi_id;
  end if;

  return v_row;
end;
$$;

comment on function public.upsert_daily_kpi_report(uuid, date, text, text, text, uuid) is
  'Upsert one daily kpi_history row for (kpi_id, report_date) and sync kpis.current_value/status/updated_at in one transaction.';

grant execute on function public.upsert_daily_kpi_report(uuid, date, text, text, text, uuid)
  to authenticated;
