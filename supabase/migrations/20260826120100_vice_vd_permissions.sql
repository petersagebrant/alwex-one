-- Vice VD system permissions: same as VD, including user administration and
-- VD Briefing. Role-based via is_vd_equivalent(); no email/UUID special-case.

create or replace function public.is_vd_equivalent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_app_role(array['vd', 'vice_vd']::public.app_role[]);
$$;

comment on function public.is_vd_equivalent() is
  'True when the current profile role is vd or vice_vd.';

revoke all on function public.is_vd_equivalent() from public;
grant execute on function public.is_vd_equivalent() to authenticated;

create or replace function public.can_read_business_area(area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when area_id is null then false
    when public.is_vd_equivalent()
      or public.has_app_role(
        array['administrator', 'lasbehorighet']::public.app_role[]
      )
      then true
    when public.has_app_role(array['ao_chef']::public.app_role[])
      then public.current_business_area_id() = area_id
    else false
  end;
$$;

create or replace function public.can_write_operational(area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when area_id is null then false
    when public.is_vd_equivalent()
      or public.has_app_role(array['administrator']::public.app_role[])
      then true
    when public.has_app_role(array['ao_chef']::public.app_role[])
      then public.current_business_area_id() = area_id
    else false
  end;
$$;

create or replace function public.can_write_decisions(area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when area_id is null then false
    when public.is_vd_equivalent()
      or public.has_app_role(array['administrator']::public.app_role[])
      then true
    else false
  end;
$$;

create or replace function public.can_manage_business_areas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_vd_equivalent()
    or public.has_app_role(array['administrator']::public.app_role[]);
$$;

create or replace function public.can_administer_users()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_vd_equivalent()
    or public.has_app_role(array['administrator']::public.app_role[]);
$$;

create or replace function public.prevent_unauthorized_kpi_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    if not (
      public.is_vd_equivalent()
      or public.has_app_role(array['administrator']::public.app_role[])
    ) then
      raise exception 'Endast VD eller administratör kan arkivera eller återaktivera KPI.';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "Role: read audit_log" on public.audit_log;
create policy "Role: read audit_log"
  on public.audit_log
  for select
  to authenticated
  using (
    (
      business_area_id is null
      and (
        public.is_vd_equivalent()
        or public.has_app_role(
          array['administrator', 'lasbehorighet']::public.app_role[]
        )
      )
    )
    or public.can_read_business_area(business_area_id)
  );

drop policy if exists "Role: insert audit_log" on public.audit_log;
create policy "Role: insert audit_log"
  on public.audit_log
  for insert
  to authenticated
  with check (
    (
      public.is_vd_equivalent()
      or public.has_app_role(
        array['administrator', 'ao_chef']::public.app_role[]
      )
    )
    and (
      business_area_id is null
      or public.can_write_operational(business_area_id)
      or public.can_write_decisions(business_area_id)
    )
  );

drop policy if exists "Role: read active profiles for assignment" on public.profiles;
create policy "Role: read active profiles for assignment"
  on public.profiles
  for select
  to authenticated
  using (
    disabled_at is null
    and (
      public.is_vd_equivalent()
      or public.has_app_role(
        array['administrator', 'ao_chef']::public.app_role[]
      )
    )
  );

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

  if v_role is null or v_role not in ('vd', 'vice_vd', 'ao_chef') then
    raise exception 'AI access denied' using errcode = '42501';
  end if;

  if p_endpoint = 'vd_briefing_v1' and v_role not in ('vd', 'vice_vd') then
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
