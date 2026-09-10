-- Daglig styrning: activity owner as profile FK (same pattern as goals)
-- plus a nullable note for "what they need help/decision with".
-- Local-only until deployed. No new tables. Admin Aktiviteter unchanged.

begin;

alter table public.activities
  add column if not exists owner_id uuid
    references public.profiles (id) on delete set null,
  add column if not exists escalation_note text null;

comment on column public.activities.owner_id is
  'Assigned profile. owner remains a denormalized display_name snapshot, same as goals.';

comment on column public.activities.escalation_note is
  'Optional text: what help or decision is needed. Null when not escalated.';

create index if not exists activities_owner_id_idx
  on public.activities (owner_id);

commit;
