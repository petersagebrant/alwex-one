-- Production Auth + RLS
-- 1) Remove all development anon policies
-- 2) Ensure authenticated users have full CRUD needed by the app
-- Anon has no policies afterwards → cannot read or write (RLS enabled on all tables)

-- ---------------------------------------------------------------------------
-- Drop development anon policies
-- ---------------------------------------------------------------------------

drop policy if exists "Development: anon can read business_areas" on public.business_areas;
drop policy if exists "Development: anon can insert business_areas" on public.business_areas;
drop policy if exists "Development: anon can update business_areas" on public.business_areas;

drop policy if exists "Development: anon can read goals" on public.goals;
drop policy if exists "Development: anon can insert goals" on public.goals;
drop policy if exists "Development: anon can update goals" on public.goals;

drop policy if exists "Development: anon can read activities" on public.activities;
drop policy if exists "Development: anon can insert activities" on public.activities;
drop policy if exists "Development: anon can update activities" on public.activities;

drop policy if exists "Development: anon can read activity_comments" on public.activity_comments;
drop policy if exists "Development: anon can insert activity_comments" on public.activity_comments;

drop policy if exists "Development: anon can read decisions" on public.decisions;
drop policy if exists "Development: anon can insert decisions" on public.decisions;
drop policy if exists "Development: anon can update decisions" on public.decisions;

drop policy if exists "Development: anon can read audit_log" on public.audit_log;
drop policy if exists "Development: anon can insert audit_log" on public.audit_log;

drop policy if exists "Development: anon can read kpis" on public.kpis;
drop policy if exists "Development: anon can insert kpis" on public.kpis;
drop policy if exists "Development: anon can update kpis" on public.kpis;

drop policy if exists "Development: anon can read kpi_history" on public.kpi_history;
drop policy if exists "Development: anon can insert kpi_history" on public.kpi_history;

-- ---------------------------------------------------------------------------
-- Ensure RLS remains enabled
-- ---------------------------------------------------------------------------

alter table public.business_areas enable row level security;
alter table public.goals enable row level security;
alter table public.activities enable row level security;
alter table public.activity_comments enable row level security;
alter table public.decisions enable row level security;
alter table public.audit_log enable row level security;
alter table public.kpis enable row level security;
alter table public.kpi_history enable row level security;

-- ---------------------------------------------------------------------------
-- business_areas (select + insert already exist for authenticated)
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can update business_areas" on public.business_areas;
create policy "Authenticated users can update business_areas"
  on public.business_areas
  for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read goals" on public.goals;
create policy "Authenticated users can read goals"
  on public.goals
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert goals" on public.goals;
create policy "Authenticated users can insert goals"
  on public.goals
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update goals" on public.goals;
create policy "Authenticated users can update goals"
  on public.goals
  for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read activities" on public.activities;
create policy "Authenticated users can read activities"
  on public.activities
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert activities" on public.activities;
create policy "Authenticated users can insert activities"
  on public.activities
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update activities" on public.activities;
create policy "Authenticated users can update activities"
  on public.activities
  for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- activity_comments
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read activity_comments" on public.activity_comments;
create policy "Authenticated users can read activity_comments"
  on public.activity_comments
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert activity_comments" on public.activity_comments;
create policy "Authenticated users can insert activity_comments"
  on public.activity_comments
  for insert
  to authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- decisions
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read decisions" on public.decisions;
create policy "Authenticated users can read decisions"
  on public.decisions
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert decisions" on public.decisions;
create policy "Authenticated users can insert decisions"
  on public.decisions
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update decisions" on public.decisions;
create policy "Authenticated users can update decisions"
  on public.decisions
  for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read audit_log" on public.audit_log;
create policy "Authenticated users can read audit_log"
  on public.audit_log
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert audit_log" on public.audit_log;
create policy "Authenticated users can insert audit_log"
  on public.audit_log
  for insert
  to authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- kpis
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read kpis" on public.kpis;
create policy "Authenticated users can read kpis"
  on public.kpis
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert kpis" on public.kpis;
create policy "Authenticated users can insert kpis"
  on public.kpis
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update kpis" on public.kpis;
create policy "Authenticated users can update kpis"
  on public.kpis
  for update
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- kpi_history
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can read kpi_history" on public.kpi_history;
create policy "Authenticated users can read kpi_history"
  on public.kpi_history
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert kpi_history" on public.kpi_history;
create policy "Authenticated users can insert kpi_history"
  on public.kpi_history
  for insert
  to authenticated
  with check (true);
