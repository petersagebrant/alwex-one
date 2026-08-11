-- Migration: KPI kinds (TARGET vs STATISTIC) and Statistik status
--
-- TARGET (default): existing goal/status KPIs — Grön/Gul/Röd unchanged.
-- STATISTIC: volume/stats measures with no target, direction, or G/Y/R status.
-- Stored status for statistics is 'Statistik' (never shown as "-" in UI).

-- ---------------------------------------------------------------------------
-- kpi_kind
-- ---------------------------------------------------------------------------

alter table public.kpis
  add column if not exists kpi_kind text not null default 'TARGET';

alter table public.kpis
  drop constraint if exists kpis_kpi_kind_check;

alter table public.kpis
  add constraint kpis_kpi_kind_check
    check (kpi_kind in ('TARGET', 'STATISTIC'));

comment on column public.kpis.kpi_kind is
  'TARGET = goal KPI with Grön/Gul/Röd. STATISTIC = measure without target/status bands.';

-- ---------------------------------------------------------------------------
-- Status checks: allow Statistik
-- ---------------------------------------------------------------------------

alter table public.kpis
  drop constraint if exists kpis_status_check;

alter table public.kpis
  add constraint kpis_status_check
    check (status in ('Grön', 'Gul', 'Röd', 'Statistik'));

alter table public.kpis
  drop constraint if exists kpis_kind_status_consistency;

alter table public.kpis
  add constraint kpis_kind_status_consistency
    check (
      (kpi_kind = 'TARGET' and status in ('Grön', 'Gul', 'Röd'))
      or (kpi_kind = 'STATISTIC' and status = 'Statistik')
    );

alter table public.kpi_history
  drop constraint if exists kpi_history_status_check;

alter table public.kpi_history
  add constraint kpi_history_status_check
    check (status in ('Grön', 'Gul', 'Röd', 'Statistik'));

-- ---------------------------------------------------------------------------
-- Daily report RPC: accept Statistik; preserve Statistik on prior snapshot
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
  v_prior_recorded_at timestamptz;
  v_value text;
  v_actor uuid;
  v_existing_id uuid;
  v_old_value text;
  v_old_status text;
  v_prior_date date;
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

  if p_status is null or p_status not in ('Grön', 'Gul', 'Röd', 'Statistik') then
    raise exception 'invalid status';
  end if;

  v_actor := coalesce(p_recorded_by, auth.uid());

  -- Stable midday timestamp in Europe/Stockholm for the report calendar day
  v_recorded_at :=
    ((p_report_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

  select h.id
  into v_existing_id
  from public.kpi_history as h
  where h.kpi_id = p_kpi_id
    and h.report_date = p_report_date
  limit 1;

  if v_existing_id is null then
    -- First report today: lock KPI and preserve current snapshot as prior day if free.
    select k.current_value, k.status
    into v_old_value, v_old_status
    from public.kpis as k
    where k.id = p_kpi_id
    for update;

    if not found then
      raise exception 'KPI not found: %', p_kpi_id;
    end if;

    v_old_value := btrim(coalesce(v_old_value, ''));
    if v_old_value <> '' then
      v_prior_date := p_report_date - 1;
      v_prior_recorded_at :=
        ((v_prior_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

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
        v_old_value,
        case
          when v_old_status in ('Grön', 'Gul', 'Röd', 'Statistik') then v_old_status
          else 'Gul'
        end,
        'Bevarat före dagsrapport',
        v_prior_recorded_at,
        v_prior_date,
        v_actor
      )
      on conflict (kpi_id, report_date) do nothing;
    end if;
  end if;

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
  'Upsert one daily kpi_history row for (kpi_id, report_date), preserve prior current_value on first report of the day when prior day is free, and sync kpis.current_value/status/updated_at. Status may be Grön/Gul/Röd/Statistik.';
