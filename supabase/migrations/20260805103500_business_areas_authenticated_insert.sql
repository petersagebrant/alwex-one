-- Allow authenticated users to insert business_areas
-- Mirrors existing select policy structure

create policy "Authenticated users can insert business_areas"
  on public.business_areas
  for insert
  to authenticated
  with check (true);
