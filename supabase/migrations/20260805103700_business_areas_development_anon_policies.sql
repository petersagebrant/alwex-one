-- DEVELOPMENT ONLY
-- Temporary RLS policies so the app can read/insert business_areas
-- before authentication is implemented (client uses the anon/publishable key).
--
-- IMPORTANT: Remove these policies before production.
-- Replace with authenticated (or role-based) policies when login is live.

create policy "Development: anon can read business_areas"
  on public.business_areas
  for select
  to anon
  using (true);

create policy "Development: anon can insert business_areas"
  on public.business_areas
  for insert
  to anon
  with check (true);

-- TODO(production): drop the two policies above before go-live.
-- Example:
--   drop policy "Development: anon can read business_areas" on public.business_areas;
--   drop policy "Development: anon can insert business_areas" on public.business_areas;
