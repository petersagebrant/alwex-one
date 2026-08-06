-- Migration: create kpi_history
-- Alwex One — historikvärden för KPI

create table public.kpi_history (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis (id) on delete cascade,
  value text not null,
  status text not null default 'Gul',
  comment text,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint kpi_history_status_check
    check (status in ('Grön', 'Gul', 'Röd'))
);

create index kpi_history_kpi_id_idx
  on public.kpi_history (kpi_id);

create index kpi_history_recorded_at_idx
  on public.kpi_history (recorded_at desc);

comment on table public.kpi_history is
  'Historik över registrerade KPI-värden över tid';

alter table public.kpi_history enable row level security;

-- DEVELOPMENT ONLY
-- Temporary RLS so the app can read/insert kpi_history before auth
-- is implemented (client uses the anon/publishable key).
--
-- IMPORTANT: Remove these policies before production.
-- Replace with authenticated (or role-based) policies when login is live.

create policy "Development: anon can read kpi_history"
  on public.kpi_history
  for select
  to anon
  using (true);

create policy "Development: anon can insert kpi_history"
  on public.kpi_history
  for insert
  to anon
  with check (true);

-- TODO(production): drop the two policies above before go-live.
-- Example:
--   drop policy "Development: anon can read kpi_history" on public.kpi_history;
--   drop policy "Development: anon can insert kpi_history" on public.kpi_history;
