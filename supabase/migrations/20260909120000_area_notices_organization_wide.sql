-- Org-wide Aktuellt: business_area_id NULL = hela organisationen.
-- Write: only vd / vice_vd via is_vd_equivalent(). Not administrator, not AO-chef.
-- Area-scoped write stays on can_write_operational.
-- Do not use Alwex totalt. Existing notice rows are not updated.

begin;

alter table public.area_notices
  alter column business_area_id drop not null;

comment on table public.area_notices is
  'Aktuellt-inlägg per operativt affärsområde, eller hela organisationen när business_area_id är null. Soft-archive; ingen hård delete.';

comment on column public.area_notices.business_area_id is
  'Operativt affärsområde. Null = hela organisationen (VD och Vice VD). Inte Alwex totalt.';

create index if not exists area_notices_org_wide_created_at_idx
  on public.area_notices (created_at desc)
  where business_area_id is null and archived_at is null;

create or replace function public.prevent_unauthorized_area_notice_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    if coalesce(new.business_area_id, old.business_area_id) is null then
      if not public.is_vd_equivalent() then
        raise exception
          'Du saknar behörighet att arkivera eller återaktivera aktuellt-inlägg.';
      end if;
    elsif not public.can_write_operational(
      coalesce(new.business_area_id, old.business_area_id)
    ) then
      raise exception
        'Du saknar behörighet att arkivera eller återaktivera aktuellt-inlägg.';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "Role: insert area_notices" on public.area_notices;
create policy "Role: insert area_notices"
  on public.area_notices
  for insert
  to authenticated
  with check (
    case
      when business_area_id is null then public.is_vd_equivalent()
      else public.can_write_operational(business_area_id)
    end
  );

drop policy if exists "Role: update area_notices" on public.area_notices;
create policy "Role: update area_notices"
  on public.area_notices
  for update
  to authenticated
  using (
    case
      when business_area_id is null then public.is_vd_equivalent()
      else public.can_write_operational(business_area_id)
    end
  )
  with check (
    case
      when business_area_id is null then public.is_vd_equivalent()
      else public.can_write_operational(business_area_id)
    end
  );

commit;
