-- User roles for Alwex One
-- profiles linked to auth.users + RLS helpers that enforce permissions in the database

-- ---------------------------------------------------------------------------
-- Role enum + profiles
-- ---------------------------------------------------------------------------

create type public.app_role as enum (
  'vd',
  'ao_chef',
  'administrator',
  'lasbehorighet'
);

comment on type public.app_role is
  'VD, AO-chef, Administratör, Läsbehörighet';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  business_area_id uuid references public.business_areas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_ao_chef_requires_area check (
    (
      role = 'ao_chef'
      and business_area_id is not null
    )
    or (
      role <> 'ao_chef'
      and business_area_id is null
    )
  )
);

create index profiles_role_idx on public.profiles (role);
create index profiles_business_area_id_idx on public.profiles (business_area_id);

comment on table public.profiles is
  'App-roller för inloggade Supabase-användare. Skapas manuellt — ingen auto-provisionering.';

comment on column public.profiles.business_area_id is
  'Obligatorisk för ao_chef: det affärsområde användaren får se och uppdatera.';

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (avoid RLS recursion on profiles)
-- ---------------------------------------------------------------------------

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.current_business_area_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.business_area_id
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.has_app_role(allowed public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = any (allowed) from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.can_read_business_area(area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when area_id is null then false
    when public.has_app_role(array['vd', 'administrator', 'lasbehorighet']::public.app_role[])
      then true
    when public.has_app_role(array['ao_chef']::public.app_role[])
      then public.current_business_area_id() = area_id
    else false
  end;
$$;

create or replace function public.can_write_operational(area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when area_id is null then false
    when public.has_app_role(array['vd', 'administrator']::public.app_role[])
      then true
    when public.has_app_role(array['ao_chef']::public.app_role[])
      then public.current_business_area_id() = area_id
    else false
  end;
$$;

create or replace function public.can_write_decisions(area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when area_id is null then false
    when public.has_app_role(array['vd', 'administrator']::public.app_role[])
      then true
    else false
  end;
$$;

create or replace function public.can_manage_business_areas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_role(array['vd', 'administrator']::public.app_role[]);
$$;

create or replace function public.can_administer_users()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_role(array['administrator']::public.app_role[]);
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.current_business_area_id() from public;
revoke all on function public.has_app_role(public.app_role[]) from public;
revoke all on function public.can_read_business_area(uuid) from public;
revoke all on function public.can_write_operational(uuid) from public;
revoke all on function public.can_write_decisions(uuid) from public;
revoke all on function public.can_manage_business_areas() from public;
revoke all on function public.can_administer_users() from public;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_business_area_id() to authenticated;
grant execute on function public.has_app_role(public.app_role[]) to authenticated;
grant execute on function public.can_read_business_area(uuid) to authenticated;
grant execute on function public.can_write_operational(uuid) to authenticated;
grant execute on function public.can_write_decisions(uuid) to authenticated;
grant execute on function public.can_manage_business_areas() to authenticated;
grant execute on function public.can_administer_users() to authenticated;

-- ---------------------------------------------------------------------------
-- profiles RLS
-- ---------------------------------------------------------------------------

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.can_administer_users());

drop policy if exists "Administrators can insert profiles" on public.profiles;
create policy "Administrators can insert profiles"
  on public.profiles
  for insert
  to authenticated
  with check (public.can_administer_users());

drop policy if exists "Administrators can update profiles" on public.profiles;
create policy "Administrators can update profiles"
  on public.profiles
  for update
  to authenticated
  using (public.can_administer_users())
  with check (public.can_administer_users());

drop policy if exists "Administrators can delete profiles" on public.profiles;
create policy "Administrators can delete profiles"
  on public.profiles
  for delete
  to authenticated
  using (public.can_administer_users());

grant select, insert, update, delete on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Drop previous broad authenticated policies
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read business_areas" on public.business_areas;
drop policy if exists "Authenticated users can insert business_areas" on public.business_areas;
drop policy if exists "Authenticated users can update business_areas" on public.business_areas;

drop policy if exists "Authenticated users can read goals" on public.goals;
drop policy if exists "Authenticated users can insert goals" on public.goals;
drop policy if exists "Authenticated users can update goals" on public.goals;

drop policy if exists "Authenticated users can read activities" on public.activities;
drop policy if exists "Authenticated users can insert activities" on public.activities;
drop policy if exists "Authenticated users can update activities" on public.activities;

drop policy if exists "Authenticated users can read activity_comments" on public.activity_comments;
drop policy if exists "Authenticated users can insert activity_comments" on public.activity_comments;

drop policy if exists "Authenticated users can read decisions" on public.decisions;
drop policy if exists "Authenticated users can insert decisions" on public.decisions;
drop policy if exists "Authenticated users can update decisions" on public.decisions;

drop policy if exists "Authenticated users can read audit_log" on public.audit_log;
drop policy if exists "Authenticated users can insert audit_log" on public.audit_log;

drop policy if exists "Authenticated users can read kpis" on public.kpis;
drop policy if exists "Authenticated users can insert kpis" on public.kpis;
drop policy if exists "Authenticated users can update kpis" on public.kpis;

drop policy if exists "Authenticated users can read kpi_history" on public.kpi_history;
drop policy if exists "Authenticated users can insert kpi_history" on public.kpi_history;

-- ---------------------------------------------------------------------------
-- business_areas
-- ---------------------------------------------------------------------------

create policy "Role: read business_areas"
  on public.business_areas
  for select
  to authenticated
  using (public.can_read_business_area(id));

create policy "Role: insert business_areas"
  on public.business_areas
  for insert
  to authenticated
  with check (public.can_manage_business_areas());

create policy "Role: update business_areas"
  on public.business_areas
  for update
  to authenticated
  using (public.can_manage_business_areas())
  with check (public.can_manage_business_areas());

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------

create policy "Role: read goals"
  on public.goals
  for select
  to authenticated
  using (public.can_read_business_area(business_area_id));

create policy "Role: insert goals"
  on public.goals
  for insert
  to authenticated
  with check (public.can_write_operational(business_area_id));

create policy "Role: update goals"
  on public.goals
  for update
  to authenticated
  using (public.can_write_operational(business_area_id))
  with check (public.can_write_operational(business_area_id));

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------

create policy "Role: read activities"
  on public.activities
  for select
  to authenticated
  using (public.can_read_business_area(business_area_id));

create policy "Role: insert activities"
  on public.activities
  for insert
  to authenticated
  with check (public.can_write_operational(business_area_id));

create policy "Role: update activities"
  on public.activities
  for update
  to authenticated
  using (public.can_write_operational(business_area_id))
  with check (public.can_write_operational(business_area_id));

-- ---------------------------------------------------------------------------
-- activity_comments
-- ---------------------------------------------------------------------------

create policy "Role: read activity_comments"
  on public.activity_comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.activities a
      where a.id = activity_comments.activity_id
        and public.can_read_business_area(a.business_area_id)
    )
  );

create policy "Role: insert activity_comments"
  on public.activity_comments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.activities a
      where a.id = activity_comments.activity_id
        and public.can_write_operational(a.business_area_id)
    )
  );

-- ---------------------------------------------------------------------------
-- decisions (VD + Administratör write; AO-chef read own area only)
-- ---------------------------------------------------------------------------

create policy "Role: read decisions"
  on public.decisions
  for select
  to authenticated
  using (public.can_read_business_area(business_area_id));

create policy "Role: insert decisions"
  on public.decisions
  for insert
  to authenticated
  with check (public.can_write_decisions(business_area_id));

create policy "Role: update decisions"
  on public.decisions
  for update
  to authenticated
  using (public.can_write_decisions(business_area_id))
  with check (public.can_write_decisions(business_area_id));

-- ---------------------------------------------------------------------------
-- kpis
-- ---------------------------------------------------------------------------

create policy "Role: read kpis"
  on public.kpis
  for select
  to authenticated
  using (public.can_read_business_area(business_area_id));

create policy "Role: insert kpis"
  on public.kpis
  for insert
  to authenticated
  with check (public.can_write_operational(business_area_id));

create policy "Role: update kpis"
  on public.kpis
  for update
  to authenticated
  using (public.can_write_operational(business_area_id))
  with check (public.can_write_operational(business_area_id));

-- ---------------------------------------------------------------------------
-- kpi_history
-- ---------------------------------------------------------------------------

create policy "Role: read kpi_history"
  on public.kpi_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.kpis k
      where k.id = kpi_history.kpi_id
        and public.can_read_business_area(k.business_area_id)
    )
  );

create policy "Role: insert kpi_history"
  on public.kpi_history
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.kpis k
      where k.id = kpi_history.kpi_id
        and public.can_write_operational(k.business_area_id)
    )
  );

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

create policy "Role: read audit_log"
  on public.audit_log
  for select
  to authenticated
  using (
    (
      business_area_id is null
      and public.has_app_role(
        array['vd', 'administrator', 'lasbehorighet']::public.app_role[]
      )
    )
    or public.can_read_business_area(business_area_id)
  );

create policy "Role: insert audit_log"
  on public.audit_log
  for insert
  to authenticated
  with check (
    public.has_app_role(
      array['vd', 'administrator', 'ao_chef']::public.app_role[]
    )
    and (
      business_area_id is null
      or public.can_write_operational(business_area_id)
      or public.can_write_decisions(business_area_id)
    )
  );
