-- Migration: allow updating goals and activities (development)
-- Alwex One — RLS UPDATE for admin edit flows

-- DEVELOPMENT ONLY
-- Temporary RLS so the app can update goals/activities before auth
-- is implemented (client uses the anon/publishable key).
--
-- IMPORTANT: Remove these policies before production.

create policy "Development: anon can update goals"
  on public.goals
  for update
  to anon
  using (true)
  with check (true);

create policy "Development: anon can update activities"
  on public.activities
  for update
  to anon
  using (true)
  with check (true);

-- TODO(production): drop the policies above before go-live.
-- Example:
--   drop policy "Development: anon can update goals" on public.goals;
--   drop policy "Development: anon can update activities" on public.activities;
