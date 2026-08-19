-- Isolated AI cost controls. No existing table, policy, user, profile or KPI is modified.
-- Initial per-user limits:
--   assistant_v1: 10/minute and 100/day (VD and AO-chef)
--   vd_briefing_v1: 2/5 minutes and 24/day (VD only)

create table public.ai_rate_limit_config (
  endpoint text not null,
  window_seconds integer not null check (window_seconds > 0),
  request_limit integer not null check (request_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (endpoint, window_seconds),
  constraint ai_rate_limit_config_endpoint_check
    check (endpoint in ('assistant_v1', 'vd_briefing_v1'))
);

create table public.ai_rate_limit_buckets (
  auth_user_id uuid not null,
  endpoint text not null,
  window_seconds integer not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (
    auth_user_id,
    endpoint,
    window_seconds,
    window_started_at
  ),
  foreign key (endpoint, window_seconds)
    references public.ai_rate_limit_config(endpoint, window_seconds)
    on update cascade
    on delete cascade
);

insert into public.ai_rate_limit_config (
  endpoint,
  window_seconds,
  request_limit
) values
  ('assistant_v1', 60, 10),
  ('assistant_v1', 86400, 100),
  ('vd_briefing_v1', 300, 2),
  ('vd_briefing_v1', 86400, 24);

alter table public.ai_rate_limit_config enable row level security;
alter table public.ai_rate_limit_buckets enable row level security;

revoke all on table public.ai_rate_limit_config from public, anon, authenticated;
revoke all on table public.ai_rate_limit_buckets from public, anon, authenticated;

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
   where p.id = v_uid;

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

  -- Lock every active window in stable order. Concurrent calls for the same
  -- auth.uid serialize here; users and endpoints remain independent.
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

revoke all on function public.consume_ai_rate_limit(text) from public, anon;
grant execute on function public.consume_ai_rate_limit(text) to authenticated;

comment on table public.ai_rate_limit_config is
  'Server-managed AI endpoint limits; no direct authenticated access.';
comment on table public.ai_rate_limit_buckets is
  'Atomic per-auth.uid AI usage windows; no direct authenticated access.';
comment on function public.consume_ai_rate_limit(text) is
  'Atomically consumes configured AI limits after deriving auth.uid and profile.';
