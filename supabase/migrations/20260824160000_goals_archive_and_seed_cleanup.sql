-- Goals: soft-archive + owner_id + permanent seed cleanup.
--
-- archived_at NULL = active (admin list, area page, dashboard, assistant).
-- archived_at set = archived (hidden from operational views; row and history kept).
--
-- Archive permission: AO-chef may archive/unarchive own-area goals;
-- VD/administrator all areas. Enforced by can_write_operational (RLS + trigger).
-- This is intentionally wider than KPI archive (prevent_unauthorized_kpi_archive
-- is VD/admin only).
--
-- Seed cleanup: permanently delete 12 placeholder seed goals. KEEP
-- 2db72ed9-9e99-4340-94db-36e3d050b311 (Nå budgeterat årsresultat, Fröträdet).
-- Do not rewrite 20260807110000 — a fresh DB recreates those seed rows, then
-- this migration deletes them (same pattern as Fröträdet Leveransförmåga archive).
--
-- Does not alter kpis, kpi_history, users, or other AO data.

begin;

alter table public.goals
  add column if not exists archived_at timestamptz null;

alter table public.goals
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;

comment on column public.goals.archived_at is
  'When set, goal is archived: excluded from operational lists. History and row are kept.';

comment on column public.goals.owner_id is
  'Assigned profile. owner remains a denormalized display_name snapshot for history.';

create index if not exists goals_archived_at_idx
  on public.goals (archived_at);

create index if not exists goals_owner_id_idx
  on public.goals (owner_id);

drop index if exists public.goals_business_area_id_title_uidx;

create unique index if not exists goals_business_area_id_title_active_uidx
  on public.goals (business_area_id, title)
  where archived_at is null;

-- Extra guard on archived_at. RLS already requires can_write_operational;
-- AO-chef may archive own-area goals, VD/admin all.
create or replace function public.prevent_unauthorized_goal_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    if not public.can_write_operational(
      coalesce(new.business_area_id, old.business_area_id)
    ) then
      raise exception
        'Du saknar behörighet att arkivera eller återaktivera mål.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists goals_prevent_unauthorized_archive on public.goals;

create trigger goals_prevent_unauthorized_archive
  before update on public.goals
  for each row
  execute function public.prevent_unauthorized_goal_archive();

-- Owner picker: operational writers may list active profiles.
-- Lasbehorighet still only sees own profile. Disabled users stay hidden here;
-- VD/admin still see them via can_administer_users on the existing policy.
drop policy if exists "Role: read active profiles for assignment" on public.profiles;

create policy "Role: read active profiles for assignment"
  on public.profiles
  for select
  to authenticated
  using (
    disabled_at is null
    and public.has_app_role(
      array['vd', 'administrator', 'ao_chef']::public.app_role[]
    )
  );

-- Permanent removal of 12 seed placeholders. Keep Fröträdet årsresultat.
delete from public.goals
where id in (
  '9297644f-2402-4a2c-ba19-e1078392ee8e',
  '5808ea0d-76c6-4212-80a5-3f8a4c241c2e',
  '78f1229f-8a10-4428-b8a8-2fedaad41de8',
  '9bf64c7e-6129-43c2-bab3-b0b79cc4e9e7',
  '3b5c0379-a602-49a0-8e7c-d9a316914a7c',
  '7ff9dc35-132b-4e43-8694-91795dfce7da',
  '9f4d3dbb-2342-4861-9459-7956a05fc8ba',
  '507f62a3-646e-45b6-9992-493bdcda34c4',
  '2805c42f-631b-4c38-a35d-43c1efc68674',
  'ccd857d8-2982-4321-9188-d144e114697f',
  'c84bf957-0f00-414f-8cd8-e42a60b99fb3',
  '6bababc1-3d21-4745-851e-10f18c7fbac1'
)
and id <> '2db72ed9-9e99-4340-94db-36e3d050b311';

commit;
