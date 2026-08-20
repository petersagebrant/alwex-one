-- User administration for LEIR (VD + administrator).
--
-- Do NOT reintroduce a 24000-era auto-provision migration (e.g.
-- 20260807240000) that created public.profiles from auth.users.
-- Profiles are created only when VD/administrator invites a user.
-- There is intentionally NO trigger on auth.users.

begin;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists display_name text not null default '';

alter table public.profiles
  add column if not exists disabled_at timestamptz null;

comment on column public.profiles.display_name is
  'Visningsnamn. Sätts vid inbjudan; lagras inte i Auth som källa.';

comment on column public.profiles.disabled_at is
  'När satt behandlas profilen som saknad av has_app_role/can_*-helpers (fail-closed).';

-- ---------------------------------------------------------------------------
-- Helpers: fail-closed for disabled_at
-- ---------------------------------------------------------------------------

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.disabled_at is null;
$$;

create or replace function public.current_business_area_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.business_area_id
  from public.profiles p
  where p.id = auth.uid()
    and p.disabled_at is null;
$$;

create or replace function public.has_app_role(allowed public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role = any (allowed)
      from public.profiles p
      where p.id = auth.uid()
        and p.disabled_at is null
    ),
    false
  );
$$;

create or replace function public.can_administer_users()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_role(
    array['vd', 'administrator']::public.app_role[]
  );
$$;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

-- ---------------------------------------------------------------------------
-- Self-update: nobody may change their own role or business_area_id
-- ---------------------------------------------------------------------------

create or replace function public.prevent_self_role_or_area_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.id = auth.uid() then
    if new.role is distinct from old.role
       or new.business_area_id is distinct from old.business_area_id then
      raise exception
        'Du kan inte ändra din egen roll eller affärsområde.'
        using errcode = '42501';
    end if;

    if new.disabled_at is distinct from old.disabled_at then
      raise exception
        'Du kan inte ändra status på ditt eget konto.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_or_area_change on public.profiles;
create trigger profiles_prevent_self_role_or_area_change
  before update on public.profiles
  for each row
  execute function public.prevent_self_role_or_area_change();

-- ---------------------------------------------------------------------------
-- Protected system users (hardcoded UUIDs)
--   VD:      169202b9-ee9a-47f3-9e0d-5e69898c6f7d
--   AO-test: 6d867c73-2196-4c8f-a247-7e91f9f12aca
-- ---------------------------------------------------------------------------

create or replace function public.protect_system_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vd_id constant uuid := '169202b9-ee9a-47f3-9e0d-5e69898c6f7d';
  ao_test_id constant uuid := '6d867c73-2196-4c8f-a247-7e91f9f12aca';
begin
  if tg_op = 'DELETE' then
    if old.id in (vd_id, ao_test_id) then
      raise exception
        'Skyddat systemkonto kan inte raderas.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if old.id in (vd_id, ao_test_id) and new.disabled_at is not null then
    raise exception
      'Skyddat systemkonto kan inte inaktiveras.'
      using errcode = '42501';
  end if;

  if old.id = vd_id and new.role is distinct from 'vd'::public.app_role then
    raise exception
      'VD-kontot kan inte nedgraderas.'
      using errcode = '42501';
  end if;

  if old.id = ao_test_id and new.role is distinct from old.role then
    raise exception
      'AO-testkontot kan inte byta roll.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_system_before_update on public.profiles;
create trigger profiles_protect_system_before_update
  before update on public.profiles
  for each row
  execute function public.protect_system_profiles();

drop trigger if exists profiles_protect_system_before_delete on public.profiles;
create trigger profiles_protect_system_before_delete
  before delete on public.profiles
  for each row
  execute function public.protect_system_profiles();

-- ---------------------------------------------------------------------------
-- Grants: same spirit as 20260818280000 (no TRUNCATE etc.)
-- ---------------------------------------------------------------------------

revoke all privileges on table public.profiles from public;

revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.profiles
  from anon;

grant select, insert, update, delete
  on table public.profiles
  to authenticated;

revoke truncate, references, trigger, maintain
  on table public.profiles
  from authenticated;

-- ---------------------------------------------------------------------------
-- AI rate limit: disabled profiles are missing (fail-closed)
-- ---------------------------------------------------------------------------

create or replace function public.consume_ai_rate_limit(p_endpoint text)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  limit_value integer,
  remaining integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_config record;
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_retry integer := 0;
  v_limit integer := 0;
  v_remaining integer := 0;
begin
  if v_uid is null then
    raise exception 'AI authentication required' using errcode = '42501';
  end if;

  if p_endpoint not in ('assistant_v1', 'vd_briefing_v1') then
    raise exception 'Unknown AI endpoint' using errcode = '22023';
  end if;

  select p.role
    into v_role
    from public.profiles as p
   where p.id = v_uid
     and p.disabled_at is null;

  if v_role is null or v_role not in ('vd', 'ao_chef') then
    raise exception 'AI access denied' using errcode = '42501';
  end if;

  if p_endpoint = 'vd_briefing_v1' and v_role <> 'vd' then
    raise exception 'VD Briefing access denied' using errcode = '42501';
  end if;

  if v_role = 'ao_chef'
     and not exists (
       select 1
         from public.profiles as p
        where p.id = v_uid
          and p.role = 'ao_chef'
          and p.business_area_id is not null
          and p.disabled_at is null
     ) then
    raise exception 'AI business area required' using errcode = '42501';
  end if;

  for v_config in
    select c.window_seconds, c.request_limit
      from public.ai_rate_limit_config as c
     where c.endpoint = p_endpoint
     order by c.window_seconds
  loop
    v_window_start :=
      to_timestamp(
        floor(extract(epoch from v_now) / v_config.window_seconds)
        * v_config.window_seconds
      );

    insert into public.ai_rate_limit_buckets (
      auth_user_id,
      endpoint,
      window_seconds,
      window_started_at,
      request_count
    ) values (
      v_uid,
      p_endpoint,
      v_config.window_seconds,
      v_window_start,
      0
    )
    on conflict do nothing;
  end loop;

  if not found then
    raise exception 'AI endpoint is not configured' using errcode = '55000';
  end if;

  perform b.auth_user_id
    from public.ai_rate_limit_buckets as b
    join public.ai_rate_limit_config as c
      on c.endpoint = b.endpoint
     and c.window_seconds = b.window_seconds
   where b.auth_user_id = v_uid
     and b.endpoint = p_endpoint
     and b.window_started_at =
       to_timestamp(
         floor(extract(epoch from v_now) / b.window_seconds)
         * b.window_seconds
       )
   order by b.window_seconds
   for update of b;

  select
    coalesce(
      max(
        ceil(
          extract(
            epoch from
              b.window_started_at
              + make_interval(secs => b.window_seconds)
              - v_now
          )
        )::integer
      ) filter (where b.request_count >= c.request_limit),
      0
    ),
    min(c.request_limit),
    min(greatest(c.request_limit - b.request_count - 1, 0))
    into v_retry, v_limit, v_remaining
    from public.ai_rate_limit_buckets as b
    join public.ai_rate_limit_config as c
      on c.endpoint = b.endpoint
     and c.window_seconds = b.window_seconds
   where b.auth_user_id = v_uid
     and b.endpoint = p_endpoint
     and b.window_started_at =
       to_timestamp(
         floor(extract(epoch from v_now) / b.window_seconds)
         * b.window_seconds
       );

  if v_retry > 0 then
    return query
      select false, greatest(v_retry, 1), v_limit, 0;
    return;
  end if;

  update public.ai_rate_limit_buckets as b
     set request_count = b.request_count + 1,
         updated_at = v_now
   where b.auth_user_id = v_uid
     and b.endpoint = p_endpoint
     and b.window_started_at =
       to_timestamp(
         floor(extract(epoch from v_now) / b.window_seconds)
         * b.window_seconds
       );

  return query select true, 0, v_limit, v_remaining;
end;
$$;

commit;
