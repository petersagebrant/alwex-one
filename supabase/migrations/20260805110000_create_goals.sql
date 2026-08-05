-- Migration: create goals
-- Alwex One — målstyrning

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  business_area_id uuid not null references public.business_areas (id) on delete cascade,
  title text not null,
  description text,
  owner text,
  status text not null default 'Gul',
  target_value text,
  current_value text,
  deadline date,
  progress integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint goals_status_check
    check (status in ('Grön', 'Gul', 'Röd')),

  constraint goals_progress_check
    check (progress is null or (progress >= 0 and progress <= 100))
);

create index goals_business_area_id_idx
  on public.goals (business_area_id);

comment on table public.goals is
  'Mål kopplade till affärsområden';

alter table public.goals enable row level security;

-- DEVELOPMENT ONLY
-- Temporary RLS so the app can read/insert goals before auth is implemented
-- (client uses the anon/publishable key).
--
-- IMPORTANT: Remove these policies before production.
-- Replace with authenticated (or role-based) policies when login is live.

create policy "Development: anon can read goals"
  on public.goals
  for select
  to anon
  using (true);

create policy "Development: anon can insert goals"
  on public.goals
  for insert
  to anon
  with check (true);

-- TODO(production): drop the two policies above before go-live.
-- Example:
--   drop policy "Development: anon can read goals" on public.goals;
--   drop policy "Development: anon can insert goals" on public.goals;
