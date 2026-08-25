-- Goals: explicit kinds (MEASURABLE | ACTIVITY) and lifecycle (ACTIVE | DONE).
--
-- Grön/Gul/Röd remains pace/status. DONE is "Klart" — not the same as Grön.
-- Default kind MEASURABLE and lifecycle ACTIVE so existing rows stay operational.
--
-- Live Fröträdet årsresultat (2db72ed9-9e99-4340-94db-36e3d050b311):
-- tagged MEASURABLE + ACTIVE only. Do NOT recalculate or rewrite progress,
-- status, current_value, target_value, or owner.
--
-- Does not rewrite 20260807110000 seed. Does not alter kpis / kpi_history.

begin;

alter table public.goals
  add column if not exists goal_kind text not null default 'MEASURABLE';

alter table public.goals
  add column if not exists lifecycle text not null default 'ACTIVE';

alter table public.goals
  drop constraint if exists goals_goal_kind_check;

alter table public.goals
  add constraint goals_goal_kind_check
  check (goal_kind in ('MEASURABLE', 'ACTIVITY'));

alter table public.goals
  drop constraint if exists goals_lifecycle_check;

alter table public.goals
  add constraint goals_lifecycle_check
  check (lifecycle in ('ACTIVE', 'DONE'));

comment on column public.goals.goal_kind is
  'MEASURABLE = current/target/deadline with auto progress and G/Y/R. ACTIVITY = followed via activities.goal_id; G/Y/R is manual.';

comment on column public.goals.lifecycle is
  'ACTIVE = ongoing (Aktivt). DONE = completed (Klart). Independent of Grön/Gul/Röd.';

-- Explicit tag only. Defaults already cover other rows. Do not touch stored 70/Grön.
update public.goals
set
  goal_kind = 'MEASURABLE',
  lifecycle = 'ACTIVE'
where id = '2db72ed9-9e99-4340-94db-36e3d050b311';

commit;
