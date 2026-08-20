-- Lager & Logistik KPIs + reusable SUM_DIVIDE + reporting_frequency
--
-- Extends calc operators:
--   SUM_DIVIDE = SUM(numerator KPIs) / denominator  (CALCULATED Statistik)
-- Numerators live in kpi_calc_sum_numerators; denominator on kpis.calc_denominator_kpi_id.
--
-- reporting_frequency: DAILY (default) | MONTHLY — MONTHLY excluded from daily progress.

-- ---------------------------------------------------------------------------
-- reporting_frequency
-- ---------------------------------------------------------------------------

alter table public.kpis
  add column if not exists reporting_frequency text not null default 'DAILY';

alter table public.kpis
  drop constraint if exists kpis_reporting_frequency_check;

alter table public.kpis
  add constraint kpis_reporting_frequency_check
    check (reporting_frequency in ('DAILY', 'MONTHLY'));

comment on column public.kpis.reporting_frequency is
  'DAILY = included in today''s reporting progress. MONTHLY = reportable but excluded from daily X av Y.';

-- ---------------------------------------------------------------------------
-- SUM_DIVIDE numerator junction
-- ---------------------------------------------------------------------------

create table if not exists public.kpi_calc_sum_numerators (
  id uuid primary key default gen_random_uuid(),
  parent_kpi_id uuid not null references public.kpis (id) on delete cascade,
  numerator_kpi_id uuid not null references public.kpis (id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint kpi_calc_sum_numerators_not_self
    check (parent_kpi_id <> numerator_kpi_id),
  constraint kpi_calc_sum_numerators_unique_pair
    unique (parent_kpi_id, numerator_kpi_id)
);

create index if not exists kpi_calc_sum_numerators_parent_idx
  on public.kpi_calc_sum_numerators (parent_kpi_id);

create index if not exists kpi_calc_sum_numerators_numerator_idx
  on public.kpi_calc_sum_numerators (numerator_kpi_id);

comment on table public.kpi_calc_sum_numerators is
  'Explicit numerator KPI list for CALCULATED SUM_DIVIDE parents. All numerators required for a period write.';

alter table public.kpi_calc_sum_numerators enable row level security;

drop policy if exists kpi_calc_sum_numerators_select_authenticated
  on public.kpi_calc_sum_numerators;
create policy kpi_calc_sum_numerators_select_authenticated
  on public.kpi_calc_sum_numerators
  for select
  to authenticated
  using (true);

drop policy if exists kpi_calc_sum_numerators_write_authenticated
  on public.kpi_calc_sum_numerators;
create policy kpi_calc_sum_numerators_write_authenticated
  on public.kpi_calc_sum_numerators
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
      or calc_operator in (
        'DIVIDE',
        'SUM_DIVIDE',
        'RATIO_PERCENT',
        'WEIGHTED_RATIO_PERCENT'
      )
    );

comment on column public.kpis.calc_operator is
  'CALCULATED: DIVIDE or SUM_DIVIDE. TARGET computed: RATIO_PERCENT or WEIGHTED_RATIO_PERCENT.';

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
        kpi_kind = 'CALCULATED'
        and calc_operator = 'SUM_DIVIDE'
        and calc_numerator_kpi_id is null
        and calc_denominator_kpi_id is not null
        and calc_denominator_kpi_id <> id
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
  'TARGET = goal KPI with Grön/Gul/Röd (manual or system-computed ratio). STATISTIC = manual measure. CALCULATED = derived Statistik (DIVIDE / SUM_DIVIDE).';

-- ---------------------------------------------------------------------------
-- Recalculate dependents (DIVIDE + SUM_DIVIDE + RATIO + WEIGHTED)
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
  v_num_row record;
  v_incomplete boolean;
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

  -- CALCULATED SUM_DIVIDE: SUM(numerators) / denominator
  for v_calc in
    select distinct
      c.id,
      c.calc_denominator_kpi_id
    from public.kpis as c
    left join public.kpi_calc_sum_numerators as n
      on n.parent_kpi_id = c.id
    where c.archived_at is null
      and c.kpi_kind = 'CALCULATED'
      and c.calc_operator = 'SUM_DIVIDE'
      and c.calc_denominator_kpi_id is not null
      and (
        c.calc_denominator_kpi_id = p_input_kpi_id
        or n.numerator_kpi_id = p_input_kpi_id
      )
  loop
    select h.value
    into v_den_text
    from public.kpi_history as h
    where h.kpi_id = v_calc.calc_denominator_kpi_id
      and h.report_date = p_report_date
    limit 1;

    v_den := public.parse_kpi_numeric_text(v_den_text);
    if v_den is null or v_den = 0 then
      continue;
    end if;

    v_sum_num := 0;
    v_total := 0;
    v_incomplete := false;

    for v_num_row in
      select n.numerator_kpi_id
      from public.kpi_calc_sum_numerators as n
      where n.parent_kpi_id = v_calc.id
      order by n.sort_order, n.created_at
    loop
      v_total := v_total + 1;

      select h.value
      into v_num_text
      from public.kpi_history as h
      where h.kpi_id = v_num_row.numerator_kpi_id
        and h.report_date = p_report_date
      limit 1;

      v_num := public.parse_kpi_numeric_text(v_num_text);
      if v_num is null then
        v_incomplete := true;
        exit;
      end if;

      v_sum_num := v_sum_num + v_num;
    end loop;

    if v_incomplete or v_total = 0 then
      continue;
    end if;

    v_result := v_sum_num / v_den;
    v_value := public.format_kpi_numeric_sv(v_result);
    if v_value is null or v_value = '' then
      continue;
    end if;

    perform public.write_computed_kpi_value(
      v_calc.id,
      p_report_date,
      v_value,
      'Statistik',
      'Beräknad',
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
  'After an input KPI daily report: recompute DIVIDE, SUM_DIVIDE, RATIO_PERCENT and WEIGHTED_RATIO_PERCENT dependents. Skips incomplete/zero-denominator inputs; weighted excludes incomplete AOs from SUM.';

-- ---------------------------------------------------------------------------
-- Seed: Lager & Logistik KPIs (idempotent by name)
-- ---------------------------------------------------------------------------

do $$
declare
  v_area_id uuid := 'd6fddf98-ef3d-4f35-9a16-bbc1b7d384c6';
  v_belaggning uuid;
  v_resultat uuid;
  v_kolli_ooh uuid;
  v_kolli_byggmax uuid;
  v_arbetade uuid;
  v_kolli_per_timme uuid;
  v_sick_id uuid;
  v_ordinary_id uuid;
  v_pct_id uuid;
begin
  if not exists (select 1 from public.business_areas where id = v_area_id) then
    select ba.id
    into v_area_id
    from public.business_areas as ba
    where ba.slug = 'lager-logistik' or ba.name = 'Lager & Logistik'
    limit 1;
  end if;

  if v_area_id is null then
    raise notice 'Lager & Logistik not found — skipping KPI seed';
    return;
  end if;

  -- 1) Beläggningsgrad — TARGET 90 %, HIGHER_IS_BETTER (existing)
  select k.id into v_belaggning
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Beläggningsgrad'
    and k.archived_at is null
  limit 1;

  if v_belaggning is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Beläggningsgrad', 'Kapacitet', '90', null, '%',
      'Gul', 'Oförändrad', 'TARGET', 'HIGHER_IS_BETTER', 'ABSOLUTE',
      null, 5, 'DAILY'
    )
    returning id into v_belaggning;
  else
    update public.kpis
    set
      kpi_kind = 'TARGET',
      target_value = coalesce(nullif(btrim(target_value), ''), '90'),
      unit = coalesce(nullif(btrim(unit), ''), '%'),
      direction = 'HIGHER_IS_BETTER',
      tolerance_type = coalesce(tolerance_type, 'ABSOLUTE'),
      yellow_tolerance = coalesce(yellow_tolerance, 5),
      category = coalesce(nullif(btrim(category), ''), 'Kapacitet'),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = 'DAILY',
      updated_at = now()
    where id = v_belaggning;
  end if;

  -- Resultat mot budget — TARGET, MONTHLY (exclude from daily progress)
  select k.id into v_resultat
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Resultat mot budget'
    and k.archived_at is null
  limit 1;

  if v_resultat is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Resultat mot budget', 'Ekonomi', '0', null, 'Mkr',
      'Gul', 'Oförändrad', 'TARGET', 'HIGHER_IS_BETTER', 'ABSOLUTE',
      null, 0.2, 'MONTHLY'
    )
    returning id into v_resultat;
  else
    update public.kpis
    set
      kpi_kind = 'TARGET',
      target_value = coalesce(nullif(btrim(target_value), ''), '0'),
      unit = coalesce(nullif(btrim(unit), ''), 'Mkr'),
      direction = coalesce(direction, 'HIGHER_IS_BETTER'),
      tolerance_type = coalesce(tolerance_type, 'ABSOLUTE'),
      yellow_tolerance = coalesce(yellow_tolerance, 0.2),
      category = coalesce(nullif(btrim(category), ''), 'Ekonomi'),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = 'MONTHLY',
      updated_at = now()
    where id = v_resultat;
  end if;

  -- 2) Kolli OOH — STATISTIC
  select k.id into v_kolli_ooh
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Kolli OOH'
    and k.archived_at is null
  limit 1;

  if v_kolli_ooh is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Kolli OOH', 'Volym', null, null, 'kolli',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, 'DAILY'
    )
    returning id into v_kolli_ooh;
  else
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'kolli'),
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      category = coalesce(nullif(btrim(category), ''), 'Volym'),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = 'DAILY',
      updated_at = now()
    where id = v_kolli_ooh;
  end if;

  -- 3) Kolli Byggmax — STATISTIC
  select k.id into v_kolli_byggmax
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Kolli Byggmax'
    and k.archived_at is null
  limit 1;

  if v_kolli_byggmax is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Kolli Byggmax', 'Volym', null, null, 'kolli',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, 'DAILY'
    )
    returning id into v_kolli_byggmax;
  else
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'kolli'),
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      category = coalesce(nullif(btrim(category), ''), 'Volym'),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = 'DAILY',
      updated_at = now()
    where id = v_kolli_byggmax;
  end if;

  -- 4) Arbetade timmar — STATISTIC (separate from Ordinarie arbetstid)
  select k.id into v_arbetade
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Arbetade timmar'
    and k.archived_at is null
  limit 1;

  if v_arbetade is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Arbetade timmar', 'Personal', null, null, 'h',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, 'DAILY'
    )
    returning id into v_arbetade;
  else
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'h'),
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      category = coalesce(nullif(btrim(category), ''), 'Personal'),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = 'DAILY',
      updated_at = now()
    where id = v_arbetade;
  end if;

  -- Ensure Sjukfrånvaro block exists (do not break existing)
  select k.id into v_sick_id
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Sjuktimmar'
    and k.archived_at is null
  limit 1;

  select k.id into v_ordinary_id
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Ordinarie arbetstid'
    and k.archived_at is null
  limit 1;

  select k.id into v_pct_id
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Sjukfrånvaro'
    and k.archived_at is null
  limit 1;

  if v_sick_id is not null then
    update public.kpis
    set reporting_frequency = 'DAILY', updated_at = now()
    where id = v_sick_id;
  end if;
  if v_ordinary_id is not null then
    update public.kpis
    set reporting_frequency = 'DAILY', updated_at = now()
    where id = v_ordinary_id;
  end if;
  if v_pct_id is not null then
    update public.kpis
    set reporting_frequency = 'DAILY', updated_at = now()
    where id = v_pct_id;
  end if;

  -- Auto: Kolli per arbetad timme = (Kolli OOH + Kolli Byggmax) / Arbetade timmar
  select k.id into v_kolli_per_timme
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Kolli per arbetad timme'
    and k.archived_at is null
  limit 1;

  if v_kolli_per_timme is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance,
      calc_operator, calc_numerator_kpi_id, calc_denominator_kpi_id,
      reporting_frequency
    )
    values (
      v_area_id, 'Kolli per arbetad timme', 'Produktivitet', null, null, 'kolli/timme',
      'Statistik', 'Oförändrad', 'CALCULATED', null, null,
      null, null,
      'SUM_DIVIDE', null, v_arbetade,
      'DAILY'
    )
    returning id into v_kolli_per_timme;
  else
    update public.kpis
    set
      kpi_kind = 'CALCULATED',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'kolli/timme'),
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      category = coalesce(nullif(btrim(category), ''), 'Produktivitet'),
      calc_operator = 'SUM_DIVIDE',
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = v_arbetade,
      reporting_frequency = 'DAILY',
      updated_at = now()
    where id = v_kolli_per_timme;
  end if;

  insert into public.kpi_calc_sum_numerators (
    parent_kpi_id, numerator_kpi_id, sort_order
  )
  values
    (v_kolli_per_timme, v_kolli_ooh, 1),
    (v_kolli_per_timme, v_kolli_byggmax, 2)
  on conflict (parent_kpi_id, numerator_kpi_id)
  do update set sort_order = excluded.sort_order;
end;
$$;
