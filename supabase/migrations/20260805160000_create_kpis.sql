-- Migration: create kpis
-- Alwex One — nyckeltal (KPI)

create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  business_area_id uuid not null references public.business_areas (id) on delete cascade,
  name text not null,
  category text,
  target_value text,
  current_value text,
  unit text,
  status text not null default 'Gul',
  trend text not null default 'Oförändrad',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint kpis_status_check
    check (status in ('Grön', 'Gul', 'Röd')),

  constraint kpis_trend_check
    check (trend in ('Upp', 'Oförändrad', 'Ner'))
);

create index kpis_business_area_id_idx
  on public.kpis (business_area_id);

comment on table public.kpis is
  'Nyckeltal (KPI) kopplade till affärsområden';

alter table public.kpis enable row level security;

-- DEVELOPMENT ONLY
-- Temporary RLS so the app can read/insert/update kpis before auth
-- is implemented (client uses the anon/publishable key).
--
-- IMPORTANT: Remove these policies before production.
-- Replace with authenticated (or role-based) policies when login is live.

create policy "Development: anon can read kpis"
  on public.kpis
  for select
  to anon
  using (true);

create policy "Development: anon can insert kpis"
  on public.kpis
  for insert
  to anon
  with check (true);

-- UPDATE behövs för att kunna ändra KPI i admin.
create policy "Development: anon can update kpis"
  on public.kpis
  for update
  to anon
  using (true)
  with check (true);

-- TODO(production): drop the policies above before go-live.
-- Example:
--   drop policy "Development: anon can read kpis" on public.kpis;
--   drop policy "Development: anon can insert kpis" on public.kpis;
--   drop policy "Development: anon can update kpis" on public.kpis;
