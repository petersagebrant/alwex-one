-- Migration: business_areas vd_comment + UPDATE policy (development)
-- Required for editing name/description/manager/status/VD-kommentar

alter table public.business_areas
  add column if not exists vd_comment text;

comment on column public.business_areas.vd_comment is
  'VD-kommentar för affärsområdet';

-- DEVELOPMENT ONLY
-- Temporary RLS so the app can update business_areas before auth
-- is implemented (client uses the anon/publishable key).
--
-- IMPORTANT: Remove this policy before production.

create policy "Development: anon can update business_areas"
  on public.business_areas
  for update
  to anon
  using (true)
  with check (true);

-- TODO(production): drop the policy above before go-live.
-- Example:
--   drop policy "Development: anon can update business_areas" on public.business_areas;
