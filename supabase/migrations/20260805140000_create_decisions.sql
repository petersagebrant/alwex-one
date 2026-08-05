-- Migration: create decisions
-- Alwex One — beslutspunkter

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  business_area_id uuid not null references public.business_areas (id) on delete cascade,
  title text not null,
  description text,
  owner text,
  meeting_date date,
  due_date date,
  status text not null default 'Planerat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint decisions_status_check
    check (status in ('Planerat', 'Pågår', 'Klart'))
);

create index decisions_business_area_id_idx
  on public.decisions (business_area_id);

create index decisions_due_date_idx
  on public.decisions (due_date);

comment on table public.decisions is
  'Beslutspunkter kopplade till affärsområden';

alter table public.decisions enable row level security;

-- DEVELOPMENT ONLY
-- Temporary RLS so the app can read/insert/update decisions before auth
-- is implemented (client uses the anon/publishable key).
--
-- IMPORTANT: Remove these policies before production.
-- Replace with authenticated (or role-based) policies when login is live.

create policy "Development: anon can read decisions"
  on public.decisions
  for select
  to anon
  using (true);

create policy "Development: anon can insert decisions"
  on public.decisions
  for insert
  to anon
  with check (true);

create policy "Development: anon can update decisions"
  on public.decisions
  for update
  to anon
  using (true)
  with check (true);

-- TODO(production): drop the three policies above before go-live.
-- Example:
--   drop policy "Development: anon can read decisions" on public.decisions;
--   drop policy "Development: anon can insert decisions" on public.decisions;
--   drop policy "Development: anon can update decisions" on public.decisions;
