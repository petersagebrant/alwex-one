-- Migration: create activities
-- Alwex One — aktiviteter

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  business_area_id uuid not null references public.business_areas (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  title text not null,
  description text,
  owner text,
  status text not null default 'Ej påbörjad',
  priority text not null default 'Normal',
  deadline date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint activities_status_check
    check (status in ('Ej påbörjad', 'Pågår', 'Klar', 'Försenad')),

  constraint activities_priority_check
    check (priority in ('Låg', 'Normal', 'Hög'))
);

create index activities_business_area_id_idx
  on public.activities (business_area_id);

create index activities_goal_id_idx
  on public.activities (goal_id);

comment on table public.activities is
  'Aktiviteter kopplade till affärsområden och valfritt till mål';

alter table public.activities enable row level security;

-- DEVELOPMENT ONLY
-- Temporary RLS so the app can read/insert activities before auth is implemented
-- (client uses the anon/publishable key).
--
-- IMPORTANT: Remove these policies before production.
-- Replace with authenticated (or role-based) policies when login is live.

create policy "Development: anon can read activities"
  on public.activities
  for select
  to anon
  using (true);

create policy "Development: anon can insert activities"
  on public.activities
  for insert
  to anon
  with check (true);

-- TODO(production): drop the two policies above before go-live.
-- Example:
--   drop policy "Development: anon can read activities" on public.activities;
--   drop policy "Development: anon can insert activities" on public.activities;
