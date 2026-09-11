-- Generic reporting units for /rapportera (replaces free-text "åkeri").
-- Public reads via list_reporting_units() only. No anon table SELECT.
-- Unique `code` is reserved for a future /rapportera/[code] route (not built here).

begin;

create table public.reporting_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  is_active boolean not null default true,
  default_business_area_id uuid null
    references public.business_areas (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint reporting_units_name_not_blank
    check (length(trim(name)) > 0),

  constraint reporting_units_name_max
    check (char_length(name) <= 120),

  constraint reporting_units_code_unique unique (code),

  constraint reporting_units_code_format
    check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),

  constraint reporting_units_code_max
    check (char_length(code) <= 60)
);

comment on table public.reporting_units is
  'Källor för /rapportera. Publik lista via list_reporting_units(); inte SELECT för anon.';

comment on column public.reporting_units.code is
  'Unik slug för framtida /rapportera/[code]. Inte exponerad i publikt RPC.';

comment on column public.reporting_units.default_business_area_id is
  'Valfritt förvalt affärsområde i formuläret. Användaren kan byta.';

create index reporting_units_active_sort_idx
  on public.reporting_units (is_active, sort_order, name);

-- ---------------------------------------------------------------------------
-- Public list: id + name + default BA only. Active rows. No code/is_active.
-- ---------------------------------------------------------------------------

create or replace function public.list_reporting_units()
returns table (
  id uuid,
  name text,
  default_business_area_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select ru.id, ru.name, ru.default_business_area_id
  from public.reporting_units ru
  where ru.is_active = true
  order by ru.sort_order, ru.name;
$$;

comment on function public.list_reporting_units() is
  'Safe public reporting-unit list for /rapportera. id, name, default_business_area_id only; active rows.';

revoke all on function public.list_reporting_units() from public;
grant execute on function public.list_reporting_units() to anon;
grant execute on function public.list_reporting_units() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: authenticated VD / Vice VD / administrator write. No anon grants.
-- ---------------------------------------------------------------------------

alter table public.reporting_units enable row level security;

create policy "Role: read reporting_units"
  on public.reporting_units
  for select
  to authenticated
  using (
    public.is_vd_equivalent()
    or public.has_app_role(array['administrator']::public.app_role[])
  );

create policy "Role: insert reporting_units"
  on public.reporting_units
  for insert
  to authenticated
  with check (
    public.is_vd_equivalent()
    or public.has_app_role(array['administrator']::public.app_role[])
  );

create policy "Role: update reporting_units"
  on public.reporting_units
  for update
  to authenticated
  using (
    public.is_vd_equivalent()
    or public.has_app_role(array['administrator']::public.app_role[])
  )
  with check (
    public.is_vd_equivalent()
    or public.has_app_role(array['administrator']::public.app_role[])
  );

revoke all on table public.reporting_units from public;
revoke all on table public.reporting_units from anon;
revoke all on table public.reporting_units from authenticated;

grant select, insert, update on table public.reporting_units to authenticated;

commit;
