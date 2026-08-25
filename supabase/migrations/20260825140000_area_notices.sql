-- Aktuellt (area_notices): operational notice board per business area.
--
-- SELECT: every authenticated user may read notices from all areas.
-- This is intentionally wider than can_read_business_area (Peter 2026-08-25).
-- WRITE: AO-chef own area, VD/admin all — can_write_operational.
-- Soft archive only (no DELETE policy). Alwex totalt has no notice board.

begin;

create table public.area_notices (
  id uuid primary key default gen_random_uuid(),
  business_area_id uuid not null references public.business_areas (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_by_name text not null default '',
  updated_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ends_on date null,
  archived_at timestamptz null,

  constraint area_notices_kind_check
    check (kind in ('Information', 'Behov', 'Viktigt', 'Driftstörning')),

  constraint area_notices_title_not_blank
    check (length(trim(title)) > 0),

  constraint area_notices_body_not_blank
    check (length(trim(body)) > 0)
);

comment on table public.area_notices is
  'Aktuellt-inlägg per operativt affärsområde. Soft-archive; ingen hård delete.';

comment on column public.area_notices.kind is
  'Information | Behov | Viktigt | Driftstörning';

comment on column public.area_notices.ends_on is
  'Optional last visible Stockholm calendar day. Null = until archived.';

comment on column public.area_notices.archived_at is
  'When set, hidden from Aktuellt. Row and history are kept.';

create index area_notices_business_area_created_at_idx
  on public.area_notices (business_area_id, created_at desc);

create index area_notices_active_created_at_idx
  on public.area_notices (business_area_id, created_at desc)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_area_notice_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists area_notices_set_updated_at on public.area_notices;

create trigger area_notices_set_updated_at
  before update on public.area_notices
  for each row
  execute function public.set_area_notice_updated_at();

-- ---------------------------------------------------------------------------
-- Reject Alwex totalt (no notice board)
-- ---------------------------------------------------------------------------

create or replace function public.prevent_area_notice_on_totalt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.business_areas ba
    where ba.id = new.business_area_id
      and ba.slug = 'alwex-totalt'
  ) then
    raise exception 'Aktuellt kan inte skapas för Alwex totalt.';
  end if;
  return new;
end;
$$;

drop trigger if exists area_notices_prevent_totalt on public.area_notices;

create trigger area_notices_prevent_totalt
  before insert or update on public.area_notices
  for each row
  execute function public.prevent_area_notice_on_totalt();

-- Extra guard on archived_at. RLS already requires can_write_operational;
-- AO-chef may archive own-area notices, VD/admin all.
create or replace function public.prevent_unauthorized_area_notice_archive()
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
        'Du saknar behörighet att arkivera eller återaktivera aktuellt-inlägg.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists area_notices_prevent_unauthorized_archive on public.area_notices;

create trigger area_notices_prevent_unauthorized_archive
  before update on public.area_notices
  for each row
  execute function public.prevent_unauthorized_area_notice_archive();

-- Labels for dashboard/area names without joining business_areas (AO-chef
-- cannot SELECT other areas via can_read_business_area).
create or replace function public.area_notice_area_labels()
returns table (id uuid, name text, slug text)
language sql
stable
security definer
set search_path = public
as $$
  select ba.id, ba.name, ba.slug
  from public.business_areas ba
  where ba.slug is distinct from 'alwex-totalt';
$$;

revoke all on function public.area_notice_area_labels() from public;
grant execute on function public.area_notice_area_labels() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.area_notices enable row level security;

create policy "Role: read area_notices"
  on public.area_notices
  for select
  to authenticated
  using (true);

create policy "Role: insert area_notices"
  on public.area_notices
  for insert
  to authenticated
  with check (public.can_write_operational(business_area_id));

create policy "Role: update area_notices"
  on public.area_notices
  for update
  to authenticated
  using (public.can_write_operational(business_area_id))
  with check (public.can_write_operational(business_area_id));

revoke all on table public.area_notices from public;
revoke all on table public.area_notices from anon;
grant select, insert, update on table public.area_notices to authenticated;

commit;
