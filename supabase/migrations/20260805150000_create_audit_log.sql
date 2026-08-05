-- Migration: create audit_log
-- Alwex One — historik / händelselogg

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  description text not null,
  actor_name text not null,
  business_area_id uuid references public.business_areas (id) on delete set null,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx
  on public.audit_log (created_at desc);

create index audit_log_business_area_id_idx
  on public.audit_log (business_area_id);

create index audit_log_entity_type_idx
  on public.audit_log (entity_type);

comment on table public.audit_log is
  'Historik över viktiga händelser i systemet';

alter table public.audit_log enable row level security;

-- DEVELOPMENT ONLY
-- Temporary RLS so the app can read/insert audit_log before auth
-- is implemented (client uses the anon/publishable key).
--
-- IMPORTANT: Remove these policies before production.
-- Replace with authenticated (or role-based) policies when login is live.

create policy "Development: anon can read audit_log"
  on public.audit_log
  for select
  to anon
  using (true);

create policy "Development: anon can insert audit_log"
  on public.audit_log
  for insert
  to anon
  with check (true);

-- TODO(production): drop the two policies above before go-live.
-- Example:
--   drop policy "Development: anon can read audit_log" on public.audit_log;
--   drop policy "Development: anon can insert audit_log" on public.audit_log;
