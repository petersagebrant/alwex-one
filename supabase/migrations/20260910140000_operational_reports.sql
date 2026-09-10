-- Daglig styrning: operational_reports from /rapportera.
-- Anon: insert-only. Authenticated: SELECT/UPDATE per can_read / can_write.
-- No DELETE. Alwex totalt is blocked. History is kept.

begin;

create table public.operational_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  haulier_name text not null,
  business_area_id uuid not null references public.business_areas (id),
  body text not null,
  priority text not null,
  status text not null default 'ny',
  resolved_at timestamptz null,
  resolved_by uuid null references public.profiles (id) on delete set null,

  constraint operational_reports_priority_check
    check (priority in ('info', 'follow_up', 'urgent')),

  constraint operational_reports_status_check
    check (status in ('ny', 'hanteras', 'klar')),

  constraint operational_reports_haulier_not_blank
    check (length(trim(haulier_name)) > 0),

  constraint operational_reports_haulier_max
    check (char_length(haulier_name) <= 120),

  constraint operational_reports_body_not_blank
    check (length(trim(body)) > 0),

  constraint operational_reports_body_max
    check (char_length(body) <= 2000)
);

comment on table public.operational_reports is
  'Inkomna rapporter från verksamheten. Ingen hård delete; historik behålls.';

comment on column public.operational_reports.priority is
  'info | follow_up | urgent';

comment on column public.operational_reports.status is
  'ny | hanteras | klar';

create index operational_reports_status_created_at_idx
  on public.operational_reports (status, created_at desc);

create index operational_reports_business_area_status_idx
  on public.operational_reports (business_area_id, status);

-- ---------------------------------------------------------------------------
-- Reject Alwex totalt (same idea as area_notices)
-- ---------------------------------------------------------------------------

create or replace function public.prevent_operational_report_on_totalt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.business_areas ba
    where ba.id = new.business_area_id
      and ba.slug = 'alwex-totalt'
  ) then
    raise exception 'Rapporter kan inte skapas för Alwex totalt.';
  end if;
  return new;
end;
$$;

drop trigger if exists operational_reports_prevent_totalt
  on public.operational_reports;

create trigger operational_reports_prevent_totalt
  before insert or update on public.operational_reports
  for each row
  execute function public.prevent_operational_report_on_totalt();

-- ---------------------------------------------------------------------------
-- resolved_at / resolved_by follow status
-- ---------------------------------------------------------------------------

create or replace function public.sync_operational_report_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'klar' then
      new.resolved_at := null;
      new.resolved_by := null;
    end if;
    return new;
  end if;

  if new.status = 'klar' and old.status is distinct from 'klar' then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := coalesce(new.resolved_by, auth.uid());
  elsif new.status is distinct from 'klar' and old.status = 'klar' then
    new.resolved_at := null;
    new.resolved_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists operational_reports_sync_resolved
  on public.operational_reports;

create trigger operational_reports_sync_resolved
  before insert or update of status on public.operational_reports
  for each row
  execute function public.sync_operational_report_resolved();

-- ---------------------------------------------------------------------------
-- Public AO list (id + name only). No alwex-totalt.
-- ---------------------------------------------------------------------------

create or replace function public.list_operational_report_areas()
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select ba.id, ba.name
  from public.business_areas ba
  where ba.slug is distinct from 'alwex-totalt'
  order by ba.name;
$$;

comment on function public.list_operational_report_areas() is
  'Safe public AO list for /rapportera. id + name only; excludes alwex-totalt.';

revoke all on function public.list_operational_report_areas() from public;
grant execute on function public.list_operational_report_areas() to anon;
grant execute on function public.list_operational_report_areas() to authenticated;

-- ---------------------------------------------------------------------------
-- Public IP rate limit (hashed IP only; no raw IP stored)
-- ---------------------------------------------------------------------------

create table public.operational_report_rate_limits (
  ip_hash text not null,
  window_seconds integer not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (ip_hash, window_seconds, window_started_at)
);

alter table public.operational_report_rate_limits enable row level security;

revoke all on table public.operational_report_rate_limits
  from public, anon, authenticated;

create or replace function public.consume_operational_report_rate_limit(
  p_ip_hash text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hash text := nullif(trim(p_ip_hash), '');
  v_windows integer[] := array[600, 86400];
  v_limits integer[] := array[8, 30];
  v_idx integer;
  v_window integer;
  v_limit integer;
  v_window_start timestamptz;
  v_count integer;
begin
  if v_hash is null or char_length(v_hash) < 16 then
    return false;
  end if;

  for v_idx in 1 .. array_length(v_windows, 1) loop
    v_window := v_windows[v_idx];
    v_limit := v_limits[v_idx];
    v_window_start :=
      to_timestamp(
        floor(extract(epoch from v_now) / v_window) * v_window
      );

    insert into public.operational_report_rate_limits (
      ip_hash,
      window_seconds,
      window_started_at,
      request_count
    ) values (
      v_hash,
      v_window,
      v_window_start,
      0
    )
    on conflict do nothing;
  end loop;

  perform r.ip_hash
    from public.operational_report_rate_limits as r
   where r.ip_hash = v_hash
     and r.window_started_at =
       to_timestamp(
         floor(extract(epoch from v_now) / r.window_seconds) * r.window_seconds
       )
   order by r.window_seconds
   for update of r;

  select max(r.request_count)
    into v_count
    from public.operational_report_rate_limits as r
    join unnest(v_windows, v_limits) as cfg(window_seconds, request_limit)
      on cfg.window_seconds = r.window_seconds
   where r.ip_hash = v_hash
     and r.window_started_at =
       to_timestamp(
         floor(extract(epoch from v_now) / r.window_seconds) * r.window_seconds
       )
     and r.request_count >= cfg.request_limit;

  if coalesce(v_count, 0) > 0 then
    return false;
  end if;

  update public.operational_report_rate_limits as r
     set request_count = r.request_count + 1,
         updated_at = v_now
   where r.ip_hash = v_hash
     and r.window_started_at =
       to_timestamp(
         floor(extract(epoch from v_now) / r.window_seconds) * r.window_seconds
       );

  return true;
end;
$$;

comment on function public.consume_operational_report_rate_limit(text) is
  'Consumes public /rapportera limits for a hashed IP. Never stores raw IP.';

revoke all on function public.consume_operational_report_rate_limit(text)
  from public, authenticated;
grant execute on function public.consume_operational_report_rate_limit(text)
  to anon;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.operational_reports enable row level security;

create policy "Anon: insert operational_reports"
  on public.operational_reports
  for insert
  to anon
  with check (
    status = 'ny'
    and resolved_at is null
    and resolved_by is null
  );

create policy "Role: read operational_reports"
  on public.operational_reports
  for select
  to authenticated
  using (public.can_read_business_area(business_area_id));

create policy "Role: update operational_reports"
  on public.operational_reports
  for update
  to authenticated
  using (public.can_write_operational(business_area_id))
  with check (public.can_write_operational(business_area_id));

revoke all on table public.operational_reports from public;
revoke all on table public.operational_reports from anon;
revoke all on table public.operational_reports from authenticated;

grant insert on table public.operational_reports to anon;
grant select, update on table public.operational_reports to authenticated;

commit;
