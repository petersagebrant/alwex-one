-- Migration: system-computed TARGET ratios (Sjukfrånvaro)
--
-- Extends calc operators:
--   RATIO_PERCENT          = numerator/denominator × 100 (per-AO TARGET with G/Y/R)
--   WEIGHTED_RATIO_PERCENT = SUM(nums)/SUM(dens) × 100 via kpi_calc_weighted_inputs
--
-- CALCULATED + DIVIDE (Körda mil per RC) unchanged — still status Statistik.
-- Computed TARGET KPIs are not manually reportable.

-- ---------------------------------------------------------------------------
-- Weighted input pairs (explicit FK — never name matching)
-- ---------------------------------------------------------------------------

create table if not exists public.kpi_calc_weighted_inputs (
  id uuid primary key default gen_random_uuid(),
  parent_kpi_id uuid not null references public.kpis (id) on delete cascade,
  numerator_kpi_id uuid not null references public.kpis (id) on delete restrict,
  denominator_kpi_id uuid not null references public.kpis (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint kpi_calc_weighted_inputs_distinct_pair
    check (numerator_kpi_id <> denominator_kpi_id),
  constraint kpi_calc_weighted_inputs_not_self_num
    check (parent_kpi_id <> numerator_kpi_id),
  constraint kpi_calc_weighted_inputs_not_self_den
    check (parent_kpi_id <> denominator_kpi_id),
  constraint kpi_calc_weighted_inputs_unique_pair
    unique (parent_kpi_id, numerator_kpi_id, denominator_kpi_id)
);

create index if not exists kpi_calc_weighted_inputs_parent_idx
  on public.kpi_calc_weighted_inputs (parent_kpi_id);

create index if not exists kpi_calc_weighted_inputs_numerator_idx
  on public.kpi_calc_weighted_inputs (numerator_kpi_id);

create index if not exists kpi_calc_weighted_inputs_denominator_idx
  on public.kpi_calc_weighted_inputs (denominator_kpi_id);

comment on table public.kpi_calc_weighted_inputs is
  'Explicit numerator/denominator KPI pairs for WEIGHTED_RATIO_PERCENT parents. Incomplete pairs are excluded from SUM.';

alter table public.kpi_calc_weighted_inputs enable row level security;

-- Mirror kpis read/write policies loosely: authenticated can read; writers via existing app roles.
drop policy if exists kpi_calc_weighted_inputs_select_authenticated
  on public.kpi_calc_weighted_inputs;
create policy kpi_calc_weighted_inputs_select_authenticated
  on public.kpi_calc_weighted_inputs
  for select
  to authenticated
  using (true);

drop policy if exists kpi_calc_weighted_inputs_all_service
  on public.kpi_calc_weighted_inputs;
-- Service role bypasses RLS; allow authenticated insert/update/delete for admin paths.
drop policy if exists kpi_calc_weighted_inputs_write_authenticated
  on public.kpi_calc_weighted_inputs;
create policy kpi_calc_weighted_inputs_write_authenticated
  on public.kpi_calc_weighted_inputs
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Operator + consistency constraints
-- ---------------------------------------------------------------------------

alter table public.kpis
  drop constraint if exists kpis_calc_operator_check;

alter table public.kpis
  add constraint kpis_calc_operator_check
    check (
      calc_operator is null
      or calc_operator in ('DIVIDE', 'RATIO_PERCENT', 'WEIGHTED_RATIO_PERCENT')
    );

comment on column public.kpis.calc_operator is
  'CALCULATED: DIVIDE. TARGET computed: RATIO_PERCENT or WEIGHTED_RATIO_PERCENT.';

alter table public.kpis
  drop constraint if exists kpis_calc_fields_consistency;

alter table public.kpis
  add constraint kpis_calc_fields_consistency
    check (
      (
        kpi_kind = 'CALCULATED'
        and calc_operator = 'DIVIDE'
        and calc_numerator_kpi_id is not null
        and calc_denominator_kpi_id is not null
        and calc_numerator_kpi_id <> id
        and calc_denominator_kpi_id <> id
        and calc_numerator_kpi_id <> calc_denominator_kpi_id
      )
      or (
        kpi_kind = 'TARGET'
        and calc_operator = 'RATIO_PERCENT'
        and calc_numerator_kpi_id is not null
        and calc_denominator_kpi_id is not null
        and calc_numerator_kpi_id <> id
        and calc_denominator_kpi_id <> id
        and calc_numerator_kpi_id <> calc_denominator_kpi_id
        and direction is not null
        and target_value is not null
      )
      or (
        kpi_kind = 'TARGET'
        and calc_operator = 'WEIGHTED_RATIO_PERCENT'
        and calc_numerator_kpi_id is null
        and calc_denominator_kpi_id is null
        and direction is not null
        and target_value is not null
      )
      or (
        kpi_kind in ('TARGET', 'STATISTIC')
        and calc_operator is null
        and calc_numerator_kpi_id is null
        and calc_denominator_kpi_id is null
      )
    );

comment on column public.kpis.kpi_kind is
  'TARGET = goal KPI with Grön/Gul/Röd (manual or system-computed ratio). STATISTIC = manual measure. CALCULATED = derived Statistik (DIVIDE).';

-- ---------------------------------------------------------------------------
-- Parse Swedish/English numeric text → numeric
-- ---------------------------------------------------------------------------

create or replace function public.parse_kpi_numeric_text(p_text text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_norm text;
begin
  if p_text is null or btrim(p_text) = '' then
    return null;
  end if;
  v_norm := replace(replace(btrim(p_text), ' ', ''), ',', '.');
  begin
    return v_norm::numeric;
  exception
    when others then
      return null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Status computation (mirrors lib/kpi/computeStatus.ts for common cases)
-- ---------------------------------------------------------------------------

create or replace function public.compute_kpi_status_sql(
  p_direction text,
  p_tolerance_type text,
  p_green_tolerance numeric,
  p_yellow_tolerance numeric,
  p_value numeric,
  p_target numeric
)
returns text
language plpgsql
immutable
as $$
declare
  v_green numeric;
  v_worse numeric;
  v_dev numeric;
begin
  if p_direction is null
     or p_direction not in ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET_IS_BEST') then
    return null;
  end if;
  if p_tolerance_type is null or p_tolerance_type not in ('PERCENT', 'ABSOLUTE') then
    return null;
  end if;
  if p_yellow_tolerance is null or p_yellow_tolerance < 0 then
    return null;
  end if;
  if p_value is null or p_target is null then
    return null;
  end if;

  if p_direction = 'HIGHER_IS_BETTER' then
    if p_value >= p_target then
      return 'Grön';
    end if;
    if p_tolerance_type = 'PERCENT' then
      if p_target = 0 then
        return null;
      end if;
      v_worse := greatest(0, (p_target - p_value) / abs(p_target)) * 100;
      return case when v_worse <= p_yellow_tolerance then 'Gul' else 'Röd' end;
    end if;
    v_worse := greatest(0, p_target - p_value);
    return case when v_worse <= p_yellow_tolerance then 'Gul' else 'Röd' end;
  end if;

  if p_direction = 'LOWER_IS_BETTER' then
    if p_value <= p_target then
      return 'Grön';
    end if;
    if p_tolerance_type = 'PERCENT' then
      if p_target = 0 then
        return null;
      end if;
      v_worse := greatest(0, (p_value - p_target) / abs(p_target)) * 100;
      return case when v_worse <= p_yellow_tolerance then 'Gul' else 'Röd' end;
    end if;
    v_worse := greatest(0, p_value - p_target);
    return case when v_worse <= p_yellow_tolerance then 'Gul' else 'Röd' end;
  end if;

  -- TARGET_IS_BEST
  if p_green_tolerance is not null and p_green_tolerance >= 0 then
    v_green := p_green_tolerance;
  elsif p_tolerance_type = 'PERCENT' then
    v_green := least(0.5, greatest(0, p_yellow_tolerance * 0.1));
  else
    v_green := greatest(0, p_yellow_tolerance * 0.01);
  end if;

  if p_tolerance_type = 'PERCENT' then
    if p_target = 0 then
      return null;
    end if;
    v_dev := (abs(p_value - p_target) / abs(p_target)) * 100;
  else
    v_dev := abs(p_value - p_target);
  end if;

  if v_dev <= v_green then
    return 'Grön';
  end if;
  if v_dev <= p_yellow_tolerance then
    return 'Gul';
  end if;
  return 'Röd';
end;
$$;

-- ---------------------------------------------------------------------------
-- Write one computed history + sync kpis row (CALCULATED Statistik or TARGET G/Y/R)
-- ---------------------------------------------------------------------------

create or replace function public.write_computed_kpi_value(
  p_kpi_id uuid,
  p_report_date date,
  p_value text,
  p_status text,
  p_comment text,
  p_recorded_by uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recorded_at timestamptz;
  v_prev_value text;
  v_prev_num numeric;
  v_new_num numeric;
  v_trend text := 'Oförändrad';
begin
  if p_kpi_id is null or p_report_date is null or p_value is null or btrim(p_value) = '' then
    return;
  end if;

  v_recorded_at :=
    ((p_report_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

  select h.value
  into v_prev_value
  from public.kpi_history as h
  where h.kpi_id = p_kpi_id
    and h.report_date is not null
    and h.report_date < p_report_date
  order by h.report_date desc
  limit 1;

  v_prev_num := public.parse_kpi_numeric_text(v_prev_value);
  v_new_num := public.parse_kpi_numeric_text(p_value);
  if v_prev_num is not null and v_new_num is not null then
    if v_new_num > v_prev_num then
      v_trend := 'Upp';
    elsif v_new_num < v_prev_num then
      v_trend := 'Ner';
    end if;
  end if;

  insert into public.kpi_history (
    kpi_id,
    value,
    status,
    comment,
    recorded_at,
    report_date,
    recorded_by
  )
  values (
    p_kpi_id,
    p_value,
    p_status,
    nullif(btrim(coalesce(p_comment, '')), ''),
    v_recorded_at,
    p_report_date,
    p_recorded_by
  )
  on conflict (kpi_id, report_date)
  do update set
    value = excluded.value,
    status = excluded.status,
    comment = excluded.comment,
    recorded_at = excluded.recorded_at,
    recorded_by = coalesce(excluded.recorded_by, public.kpi_history.recorded_by),
    updated_at = now();

  update public.kpis
  set
    current_value = p_value,
    status = p_status,
    trend = v_trend,
    updated_at = now()
  where id = p_kpi_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recalculate dependents (DIVIDE + RATIO_PERCENT + WEIGHTED_RATIO_PERCENT)
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_dependent_calculated_kpis(
  p_input_kpi_id uuid,
  p_report_date date,
  p_recorded_by uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_calc record;
  v_num_text text;
  v_den_text text;
  v_num numeric;
  v_den numeric;
  v_result numeric;
  v_value text;
  v_status text;
  v_actor uuid;
  v_target numeric;
  v_comment text;
  v_part record;
  v_sum_num numeric;
  v_sum_den numeric;
  v_reported int;
  v_total int;
  v_part_num numeric;
  v_part_den numeric;
begin
  if p_input_kpi_id is null or p_report_date is null then
    return;
  end if;

  v_actor := coalesce(p_recorded_by, auth.uid());

  -- Direct dependents: CALCULATED DIVIDE or TARGET RATIO_PERCENT
  for v_calc in
    select
      c.id,
      c.kpi_kind,
      c.calc_operator,
      c.calc_numerator_kpi_id,
      c.calc_denominator_kpi_id,
      c.direction,
      c.tolerance_type,
      c.green_tolerance,
      c.yellow_tolerance,
      c.target_value
    from public.kpis as c
    where c.archived_at is null
      and (
        (
          c.kpi_kind = 'CALCULATED'
          and c.calc_operator = 'DIVIDE'
          and (
            c.calc_numerator_kpi_id = p_input_kpi_id
            or c.calc_denominator_kpi_id = p_input_kpi_id
          )
        )
        or (
          c.kpi_kind = 'TARGET'
          and c.calc_operator = 'RATIO_PERCENT'
          and (
            c.calc_numerator_kpi_id = p_input_kpi_id
            or c.calc_denominator_kpi_id = p_input_kpi_id
          )
        )
      )
  loop
    select h.value
    into v_num_text
    from public.kpi_history as h
    where h.kpi_id = v_calc.calc_numerator_kpi_id
      and h.report_date = p_report_date
    limit 1;

    select h.value
    into v_den_text
    from public.kpi_history as h
    where h.kpi_id = v_calc.calc_denominator_kpi_id
      and h.report_date = p_report_date
    limit 1;

    -- Incomplete period → skip write (UI shows "Ej rapporterat")
    if v_num_text is null or btrim(v_num_text) = '' then
      continue;
    end if;
    if v_den_text is null or btrim(v_den_text) = '' then
      continue;
    end if;

    v_num := public.parse_kpi_numeric_text(v_num_text);
    v_den := public.parse_kpi_numeric_text(v_den_text);
    if v_num is null or v_den is null or v_den = 0 then
      continue;
    end if;

    if v_calc.calc_operator = 'DIVIDE' then
      v_result := v_num / v_den;
      v_status := 'Statistik';
      v_comment := 'Beräknad';
    else
      -- RATIO_PERCENT
      v_result := (v_num / v_den) * 100;
      v_target := public.parse_kpi_numeric_text(v_calc.target_value);
      v_status := public.compute_kpi_status_sql(
        v_calc.direction,
        v_calc.tolerance_type,
        v_calc.green_tolerance,
        v_calc.yellow_tolerance,
        v_result,
        v_target
      );
      if v_status is null then
        v_status := 'Gul';
      end if;
      v_comment := 'Beräknad';
    end if;

    v_value := public.format_kpi_numeric_sv(v_result);
    if v_value is null or v_value = '' then
      continue;
    end if;

    perform public.write_computed_kpi_value(
      v_calc.id,
      p_report_date,
      v_value,
      v_status,
      v_comment,
      v_actor
    );
  end loop;

  -- Weighted parents that reference this input
  for v_calc in
    select distinct
      c.id,
      c.direction,
      c.tolerance_type,
      c.green_tolerance,
      c.yellow_tolerance,
      c.target_value
    from public.kpis as c
    join public.kpi_calc_weighted_inputs as w
      on w.parent_kpi_id = c.id
    where c.archived_at is null
      and c.kpi_kind = 'TARGET'
      and c.calc_operator = 'WEIGHTED_RATIO_PERCENT'
      and (
        w.numerator_kpi_id = p_input_kpi_id
        or w.denominator_kpi_id = p_input_kpi_id
      )
  loop
    v_sum_num := 0;
    v_sum_den := 0;
    v_reported := 0;
    v_total := 0;

    for v_part in
      select
        w.numerator_kpi_id,
        w.denominator_kpi_id
      from public.kpi_calc_weighted_inputs as w
      where w.parent_kpi_id = v_calc.id
      order by w.sort_order, w.created_at
    loop
      v_total := v_total + 1;

      select h.value
      into v_num_text
      from public.kpi_history as h
      where h.kpi_id = v_part.numerator_kpi_id
        and h.report_date = p_report_date
      limit 1;

      select h.value
      into v_den_text
      from public.kpi_history as h
      where h.kpi_id = v_part.denominator_kpi_id
        and h.report_date = p_report_date
      limit 1;

      v_part_num := public.parse_kpi_numeric_text(v_num_text);
      v_part_den := public.parse_kpi_numeric_text(v_den_text);

      if v_part_num is null or v_part_den is null or v_part_den = 0 then
        continue;
      end if;

      v_reported := v_reported + 1;
      v_sum_num := v_sum_num + v_part_num;
      v_sum_den := v_sum_den + v_part_den;
    end loop;

    if v_reported = 0 or v_sum_den = 0 then
      continue;
    end if;

    v_result := (v_sum_num / v_sum_den) * 100;
    v_value := public.format_kpi_numeric_sv(v_result);
    if v_value is null or v_value = '' then
      continue;
    end if;

    v_target := public.parse_kpi_numeric_text(v_calc.target_value);
    v_status := public.compute_kpi_status_sql(
      v_calc.direction,
      v_calc.tolerance_type,
      v_calc.green_tolerance,
      v_calc.yellow_tolerance,
      v_result,
      v_target
    );
    if v_status is null then
      v_status := 'Gul';
    end if;

    v_comment := format(
      'Beräknad (%s av %s affärsområden rapporterade)',
      v_reported,
      v_total
    );

    perform public.write_computed_kpi_value(
      v_calc.id,
      p_report_date,
      v_value,
      v_status,
      v_comment,
      v_actor
    );
  end loop;
end;
$$;

comment on function public.recalculate_dependent_calculated_kpis(uuid, date, uuid) is
  'After an input KPI daily report: recompute DIVIDE, RATIO_PERCENT and WEIGHTED_RATIO_PERCENT dependents. Skips incomplete/zero-denominator pairs; weighted excludes incomplete AOs from SUM.';

-- ---------------------------------------------------------------------------
-- Daily report RPC: reject system-computed TARGET as well as CALCULATED
-- ---------------------------------------------------------------------------

create or replace function public.upsert_daily_kpi_report(
  p_kpi_id uuid,
  p_report_date date,
  p_value text,
  p_status text,
  p_comment text default null,
  p_recorded_by uuid default null
)
returns public.kpi_history
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.kpi_history;
  v_recorded_at timestamptz;
  v_prior_recorded_at timestamptz;
  v_value text;
  v_actor uuid;
  v_existing_id uuid;
  v_old_value text;
  v_old_status text;
  v_prior_date date;
  v_kind text;
  v_calc_operator text;
begin
  if p_kpi_id is null then
    raise exception 'kpi_id is required';
  end if;

  if p_report_date is null then
    raise exception 'report_date is required';
  end if;

  v_value := btrim(coalesce(p_value, ''));
  if v_value = '' then
    raise exception 'value is required';
  end if;

  if p_status is null or p_status not in ('Grön', 'Gul', 'Röd', 'Statistik') then
    raise exception 'invalid status';
  end if;

  select k.kpi_kind, k.calc_operator
  into v_kind, v_calc_operator
  from public.kpis as k
  where k.id = p_kpi_id;

  if not found then
    raise exception 'KPI not found: %', p_kpi_id;
  end if;

  if v_kind = 'CALCULATED' or v_calc_operator is not null then
    raise exception 'System-computed KPIs cannot be reported manually';
  end if;

  v_actor := coalesce(p_recorded_by, auth.uid());

  v_recorded_at :=
    ((p_report_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

  select h.id
  into v_existing_id
  from public.kpi_history as h
  where h.kpi_id = p_kpi_id
    and h.report_date = p_report_date
  limit 1;

  if v_existing_id is null then
    select k.current_value, k.status
    into v_old_value, v_old_status
    from public.kpis as k
    where k.id = p_kpi_id
    for update;

    if not found then
      raise exception 'KPI not found: %', p_kpi_id;
    end if;

    v_old_value := btrim(coalesce(v_old_value, ''));
    if v_old_value <> '' then
      v_prior_date := p_report_date - 1;
      v_prior_recorded_at :=
        ((v_prior_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

      insert into public.kpi_history (
        kpi_id,
        value,
        status,
        comment,
        recorded_at,
        report_date,
        recorded_by
      )
      values (
        p_kpi_id,
        v_old_value,
        case
          when v_old_status in ('Grön', 'Gul', 'Röd', 'Statistik') then v_old_status
          else 'Gul'
        end,
        'Bevarat före dagsrapport',
        v_prior_recorded_at,
        v_prior_date,
        v_actor
      )
      on conflict (kpi_id, report_date) do nothing;
    end if;
  end if;

  insert into public.kpi_history (
    kpi_id,
    value,
    status,
    comment,
    recorded_at,
    report_date,
    recorded_by
  )
  values (
    p_kpi_id,
    v_value,
    p_status,
    nullif(btrim(coalesce(p_comment, '')), ''),
    v_recorded_at,
    p_report_date,
    v_actor
  )
  on conflict (kpi_id, report_date)
  do update set
    value = excluded.value,
    status = excluded.status,
    comment = excluded.comment,
    recorded_at = excluded.recorded_at,
    recorded_by = coalesce(excluded.recorded_by, public.kpi_history.recorded_by),
    updated_at = now()
  returning * into v_row;

  update public.kpis
  set
    current_value = v_row.value,
    status = v_row.status,
    updated_at = now()
  where id = p_kpi_id;

  if not found then
    raise exception 'KPI not found: %', p_kpi_id;
  end if;

  perform public.recalculate_dependent_calculated_kpis(
    p_kpi_id,
    p_report_date,
    v_actor
  );

  return v_row;
end;
$$;

comment on function public.upsert_daily_kpi_report(uuid, date, text, text, text, uuid) is
  'Upsert daily kpi_history, sync kpis, recalculate DIVIDE/RATIO dependents. Rejects CALCULATED and TARGET with calc_operator.';

-- ---------------------------------------------------------------------------
-- Seed: Alwex totalt area + Sjukfrånvaro KPIs (7 AO + company)
-- ---------------------------------------------------------------------------

do $$
declare
  v_area_names text[] := array[
    'Kyl & Frys',
    'Lager & Logistik',
    'Fjärr & Miljö',
    'Mark & Anläggning',
    'Recycling',
    'Intermodal',
    'Fröträdet'
  ];
  v_area_name text;
  v_area_id uuid;
  v_company_area_id uuid;
  v_sick_id uuid;
  v_ordinary_id uuid;
  v_pct_id uuid;
  v_company_kpi_id uuid;
  v_sort int := 0;
  v_num_ids uuid[] := array[]::uuid[];
  v_den_ids uuid[] := array[]::uuid[];
  i int;
begin
  -- Company area
  insert into public.business_areas (name, slug, description, manager, status)
  values (
    'Alwex totalt',
    'alwex-totalt',
    'Aggregerade nyckeltal för hela Alwex (ej operativt AO).',
    null,
    'Grön'
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    description = excluded.description,
    updated_at = now()
  returning id into v_company_area_id;

  if v_company_area_id is null then
    select ba.id into v_company_area_id
    from public.business_areas as ba
    where ba.slug = 'alwex-totalt'
    limit 1;
  end if;

  foreach v_area_name in array v_area_names
  loop
    select ba.id into v_area_id
    from public.business_areas as ba
    where ba.name = v_area_name
    limit 1;

    if v_area_id is null then
      raise notice 'Area % not found — skipping sjukfrånvaro seed for area', v_area_name;
      continue;
    end if;

    -- Sjuktimmar (STATISTIC)
    select k.id into v_sick_id
    from public.kpis as k
    where k.business_area_id = v_area_id
      and k.name = 'Sjuktimmar'
      and k.archived_at is null
    limit 1;

    if v_sick_id is null then
      insert into public.kpis (
        business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance
      )
      values (
        v_area_id, 'Sjuktimmar', 'Personal', null, null, 'h',
        'Statistik', 'Oförändrad', 'STATISTIC', null, null, null, null
      )
      returning id into v_sick_id;
    else
      update public.kpis
      set
        category = coalesce(nullif(btrim(category), ''), 'Personal'),
        unit = coalesce(nullif(btrim(unit), ''), 'h'),
        kpi_kind = 'STATISTIC',
        status = 'Statistik',
        target_value = null,
        direction = null,
        tolerance_type = null,
        green_tolerance = null,
        yellow_tolerance = null,
        calc_operator = null,
        calc_numerator_kpi_id = null,
        calc_denominator_kpi_id = null,
        updated_at = now()
      where id = v_sick_id;
    end if;

    -- Ordinarie arbetstid (STATISTIC)
    select k.id into v_ordinary_id
    from public.kpis as k
    where k.business_area_id = v_area_id
      and k.name = 'Ordinarie arbetstid'
      and k.archived_at is null
    limit 1;

    if v_ordinary_id is null then
      insert into public.kpis (
        business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance
      )
      values (
        v_area_id, 'Ordinarie arbetstid', 'Personal', null, null, 'h',
        'Statistik', 'Oförändrad', 'STATISTIC', null, null, null, null
      )
      returning id into v_ordinary_id;
    else
      update public.kpis
      set
        category = coalesce(nullif(btrim(category), ''), 'Personal'),
        unit = coalesce(nullif(btrim(unit), ''), 'h'),
        kpi_kind = 'STATISTIC',
        status = 'Statistik',
        target_value = null,
        direction = null,
        tolerance_type = null,
        green_tolerance = null,
        yellow_tolerance = null,
        calc_operator = null,
        calc_numerator_kpi_id = null,
        calc_denominator_kpi_id = null,
        updated_at = now()
      where id = v_ordinary_id;
    end if;

    -- Sjukfrånvaro % (TARGET RATIO_PERCENT)
    select k.id into v_pct_id
    from public.kpis as k
    where k.business_area_id = v_area_id
      and k.name = 'Sjukfrånvaro'
      and k.archived_at is null
    limit 1;

    if v_pct_id is null then
      insert into public.kpis (
        business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance,
        calc_operator, calc_numerator_kpi_id, calc_denominator_kpi_id
      )
      values (
        v_area_id, 'Sjukfrånvaro', 'Personal', '3', null, '%',
        'Gul', 'Oförändrad', 'TARGET', 'LOWER_IS_BETTER', 'ABSOLUTE',
        null, 1,
        'RATIO_PERCENT', v_sick_id, v_ordinary_id
      )
      returning id into v_pct_id;
    else
      update public.kpis
      set
        category = coalesce(nullif(btrim(category), ''), 'Personal'),
        unit = coalesce(nullif(btrim(unit), ''), '%'),
        target_value = coalesce(nullif(btrim(target_value), ''), '3'),
        kpi_kind = 'TARGET',
        status = case
          when status in ('Grön', 'Gul', 'Röd') then status
          else 'Gul'
        end,
        direction = 'LOWER_IS_BETTER',
        tolerance_type = 'ABSOLUTE',
        yellow_tolerance = coalesce(yellow_tolerance, 1),
        calc_operator = 'RATIO_PERCENT',
        calc_numerator_kpi_id = v_sick_id,
        calc_denominator_kpi_id = v_ordinary_id,
        updated_at = now()
      where id = v_pct_id;
    end if;

    v_num_ids := array_append(v_num_ids, v_sick_id);
    v_den_ids := array_append(v_den_ids, v_ordinary_id);
  end loop;

  if v_company_area_id is null or coalesce(array_length(v_num_ids, 1), 0) = 0 then
    raise notice 'Skipping Alwex totalt Sjukfrånvaro seed — missing area or AO KPIs';
    return;
  end if;

  select k.id into v_company_kpi_id
  from public.kpis as k
  where k.business_area_id = v_company_area_id
    and k.name = 'Sjukfrånvaro Alwex totalt'
    and k.archived_at is null
  limit 1;

  if v_company_kpi_id is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance,
      calc_operator, calc_numerator_kpi_id, calc_denominator_kpi_id
    )
    values (
      v_company_area_id, 'Sjukfrånvaro Alwex totalt', 'Personal', '3', null, '%',
      'Gul', 'Oförändrad', 'TARGET', 'LOWER_IS_BETTER', 'ABSOLUTE',
      null, 1,
      'WEIGHTED_RATIO_PERCENT', null, null
    )
    returning id into v_company_kpi_id;
  else
    update public.kpis
    set
      category = coalesce(nullif(btrim(category), ''), 'Personal'),
      unit = coalesce(nullif(btrim(unit), ''), '%'),
      target_value = coalesce(nullif(btrim(target_value), ''), '3'),
      kpi_kind = 'TARGET',
      status = case
        when status in ('Grön', 'Gul', 'Röd') then status
        else 'Gul'
      end,
      direction = 'LOWER_IS_BETTER',
      tolerance_type = 'ABSOLUTE',
      yellow_tolerance = coalesce(yellow_tolerance, 1),
      calc_operator = 'WEIGHTED_RATIO_PERCENT',
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      updated_at = now()
    where id = v_company_kpi_id;
  end if;

  -- Explicit weighted pairs (FK) for each AO
  for i in 1 .. array_length(v_num_ids, 1)
  loop
    v_sort := i;
    insert into public.kpi_calc_weighted_inputs (
      parent_kpi_id,
      numerator_kpi_id,
      denominator_kpi_id,
      sort_order
    )
    values (
      v_company_kpi_id,
      v_num_ids[i],
      v_den_ids[i],
      v_sort
    )
    on conflict (parent_kpi_id, numerator_kpi_id, denominator_kpi_id)
    do update set sort_order = excluded.sort_order;
  end loop;
end;
$$;
