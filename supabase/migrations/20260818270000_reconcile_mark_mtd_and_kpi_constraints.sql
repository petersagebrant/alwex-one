-- Forward-only reconciliation after 20260818250000.
-- 20260818240000 was never applied to the linked hosted database and was
-- retired locally so a normal migration push cannot apply its stale constraint.
--
-- Scope: reconcile the latest KPI constraints, extend the reusable MTD
-- recalculation function, and configure only active Mark & Anläggning
-- Sjukfrånvaro. No history is backfilled, archived, or deleted.

begin;

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
      'WEIGHTED_RATIO_PERCENT',
      'MONTH_TO_DATE_SUM',
      'MONTH_TO_DATE_RATIO_PERCENT'
    )
  );

-- Preserve the complete post-20260818250000 model, including Lager TARGET
-- SUM_DIVIDE's forward-only effective date.
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
      kpi_kind = 'CALCULATED'
      and calc_operator = 'MONTH_TO_DATE_SUM'
      and calc_numerator_kpi_id is not null
      and calc_numerator_kpi_id <> id
      and calc_denominator_kpi_id is null
    )
    or (
      kpi_kind = 'TARGET'
      and calc_operator in (
        'RATIO_PERCENT',
        'MONTH_TO_DATE_RATIO_PERCENT'
      )
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
      and calc_operator = 'SUM_DIVIDE'
      and calc_numerator_kpi_id is null
      and calc_denominator_kpi_id is not null
      and calc_denominator_kpi_id <> id
      and direction is not null
      and target_value is not null
      and calc_effective_from is not null
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

comment on column public.kpis.calc_operator is
  'CALCULATED: DIVIDE, SUM_DIVIDE, MONTH_TO_DATE_SUM. Computed TARGET: RATIO_PERCENT, MONTH_TO_DATE_RATIO_PERCENT, SUM_DIVIDE, WEIGHTED_RATIO_PERCENT.';

-- The trigger from 20260818220000 continues to call this entry point after
-- source inserts and value, report_date, or archived_at updates.
create or replace function public.recalculate_month_to_date_kpis(
  p_input_kpi_id uuid,
  p_changed_date date,
  p_recorded_by uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_calc record;
  v_date date;
  v_sum numeric;
  v_sum_num numeric;
  v_sum_den numeric;
  v_num_count bigint;
  v_den_count bigint;
  v_result numeric;
  v_target numeric;
  v_value text;
  v_status text;
  v_actor uuid := coalesce(p_recorded_by, auth.uid());
begin
  if p_input_kpi_id is null or p_changed_date is null then
    return;
  end if;

  for v_calc in
    select
      c.id,
      c.calc_operator,
      c.calc_numerator_kpi_id,
      c.calc_denominator_kpi_id,
      c.direction,
      c.tolerance_type,
      c.green_tolerance,
      c.yellow_tolerance,
      c.target_value
    from public.kpis c
    where c.archived_at is null
      and (
        (
          c.kpi_kind = 'CALCULATED'
          and c.calc_operator = 'MONTH_TO_DATE_SUM'
          and c.calc_numerator_kpi_id = p_input_kpi_id
        )
        or (
          c.kpi_kind = 'TARGET'
          and c.calc_operator = 'MONTH_TO_DATE_RATIO_PERCENT'
          and (
            c.calc_numerator_kpi_id = p_input_kpi_id
            or c.calc_denominator_kpi_id = p_input_kpi_id
          )
        )
      )
  loop
    -- DATE values are business report dates. Bound all propagation to the
    -- changed date's calendar month; the deployment guard below intentionally
    -- performs no historical/current-month write.
    for v_date in
      select distinct d.report_date
      from (
        select p_changed_date as report_date
        union all
        select h.report_date
        from public.kpi_history h
        where (
            h.kpi_id = v_calc.calc_numerator_kpi_id
            or h.kpi_id = v_calc.calc_denominator_kpi_id
          )
          and h.report_date >= p_changed_date
          and h.report_date < (
            date_trunc('month', p_changed_date) + interval '1 month'
          )::date
      ) d
      where d.report_date is not null
      order by d.report_date
    loop
      if v_calc.calc_operator = 'MONTH_TO_DATE_SUM' then
        select coalesce(
          sum(public.parse_kpi_numeric_text(h.value)),
          0
        )
        into v_sum
        from public.kpi_history h
        where h.kpi_id = v_calc.calc_numerator_kpi_id
          and h.report_date >= date_trunc('month', v_date)::date
          and h.report_date <= v_date
          and h.archived_at is null
          and public.parse_kpi_numeric_text(h.value) is not null;

        v_value := public.format_kpi_numeric_sv(v_sum);
        perform public.write_computed_kpi_value(
          v_calc.id,
          v_date,
          v_value,
          'Statistik',
          'Beräknad månad hittills',
          v_actor
        );
        continue;
      end if;

      select
        count(*) filter (
          where public.parse_kpi_numeric_text(h.value) is not null
        ),
        coalesce(sum(public.parse_kpi_numeric_text(h.value)), 0)
      into v_num_count, v_sum_num
      from public.kpi_history h
      where h.kpi_id = v_calc.calc_numerator_kpi_id
        and h.report_date >= date_trunc('month', v_date)::date
        and h.report_date <= v_date
        and h.archived_at is null;

      select
        count(*) filter (
          where public.parse_kpi_numeric_text(h.value) is not null
        ),
        coalesce(sum(public.parse_kpi_numeric_text(h.value)), 0)
      into v_den_count, v_sum_den
      from public.kpi_history h
      where h.kpi_id = v_calc.calc_denominator_kpi_id
        and h.report_date >= date_trunc('month', v_date)::date
        and h.report_date <= v_date
        and h.archived_at is null;

      if v_num_count = 0 or v_den_count = 0 or v_sum_den = 0 then
        perform public.write_computed_kpi_value(
          v_calc.id,
          v_date,
          '—',
          'Gul',
          'Beräknad månad hittills – saknar komplett underlag',
          v_actor
        );
        continue;
      end if;

      v_result := (v_sum_num / v_sum_den) * 100;
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

      v_value := public.format_kpi_numeric_sv(v_result);
      perform public.write_computed_kpi_value(
        v_calc.id,
        v_date,
        v_value,
        v_status,
        'Beräknad månad hittills',
        v_actor
      );
    end loop;
  end loop;
end;
$$;

comment on function public.recalculate_month_to_date_kpis(uuid, date, uuid) is
  'Recomputes MONTH_TO_DATE_SUM and MONTH_TO_DATE_RATIO_PERCENT from active source rows within a calendar month; updates the changed date and later source dates in that month.';

do $$
declare
  v_area_ids uuid[];
  v_sick_ratio_ids uuid[];
  v_area_id uuid;
  v_sick_ratio_id uuid;
  v_numerator_id uuid;
  v_denominator_id uuid;
begin
  select array_agg(ba.id order by ba.id)
  into v_area_ids
  from public.business_areas ba
  where ba.slug = 'mark-anlaggning';

  if coalesce(cardinality(v_area_ids), 0) <> 1 then
    raise exception 'Expected exactly one Mark & Anläggning business area';
  end if;
  v_area_id := v_area_ids[1];

  select array_agg(k.id order by k.id)
  into v_sick_ratio_ids
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Sjukfrånvaro'
    and k.kpi_kind = 'TARGET'
    and k.archived_at is null;

  if coalesce(cardinality(v_sick_ratio_ids), 0) <> 1 then
    raise exception 'Expected exactly one active Mark & Anläggning Sjukfrånvaro TARGET';
  end if;
  v_sick_ratio_id := v_sick_ratio_ids[1];

  select k.calc_numerator_kpi_id, k.calc_denominator_kpi_id
  into v_numerator_id, v_denominator_id
  from public.kpis k
  where k.id = v_sick_ratio_id
    and k.calc_operator in (
      'RATIO_PERCENT',
      'MONTH_TO_DATE_RATIO_PERCENT'
    );

  if v_numerator_id is null
     or v_denominator_id is null
     or v_numerator_id = v_denominator_id then
    raise exception 'Mark Sjukfrånvaro must retain distinct ratio source IDs';
  end if;

  if not exists (
    select 1
    from public.kpis k
    where k.id = v_numerator_id
      and k.business_area_id = v_area_id
      and k.name = 'Sjuktimmar'
      and k.kpi_kind = 'STATISTIC'
      and k.calc_operator is null
      and k.archived_at is null
  ) then
    raise exception 'Expected active Mark Sjuktimmar STATISTIC numerator';
  end if;

  if not exists (
    select 1
    from public.kpis k
    where k.id = v_denominator_id
      and k.business_area_id = v_area_id
      and k.name = 'Ordinarie arbetstid'
      and k.kpi_kind = 'STATISTIC'
      and k.calc_operator is null
      and k.archived_at is null
  ) then
    raise exception 'Expected active Mark Ordinarie arbetstid STATISTIC denominator';
  end if;

  update public.kpis
  set calc_operator = 'MONTH_TO_DATE_RATIO_PERCENT',
      target_value = '3',
      unit = '%',
      direction = 'LOWER_IS_BETTER',
      tolerance_type = 'ABSOLUTE',
      green_tolerance = null,
      yellow_tolerance = 1,
      reporting_frequency = 'DAILY',
      ratio_reporting_mode = 'SEPARATE_INPUTS',
      updated_at = now()
  where id = v_sick_ratio_id
    and (
      calc_operator is distinct from 'MONTH_TO_DATE_RATIO_PERCENT'
      or target_value is distinct from '3'
      or unit is distinct from '%'
      or direction is distinct from 'LOWER_IS_BETTER'
      or tolerance_type is distinct from 'ABSOLUTE'
      or green_tolerance is not null
      or yellow_tolerance is distinct from 1
      or reporting_frequency is distinct from 'DAILY'
      or ratio_reporting_mode is distinct from 'SEPARATE_INPUTS'
    );

  -- Deliberately no deployment-time backfill. Existing KPI history is
  -- immutable, including earlier months and existing current-month results.
  -- Future source inserts/updates invoke the existing trigger and recompute
  -- only the changed date plus later source dates in that calendar month.
end;
$$;

commit;
