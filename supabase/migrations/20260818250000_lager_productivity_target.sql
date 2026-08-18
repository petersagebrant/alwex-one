-- Lager & Logistik: make Kolli per arbetad timme a system-computed TARGET.
-- Formula and source KPIs stay unchanged:
--   (Kolli OOH + Kolli Byggmax) / Arbetade timmar

alter table public.kpis
  add column if not exists calc_effective_from date;

comment on column public.kpis.calc_effective_from is
  'First report date eligible for forward-only calculated TARGET history. NULL preserves existing calculation behavior.';

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

create or replace function public.recalculate_target_sum_divide_kpis(
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
  v_num_row record;
  v_den_text text;
  v_num_text text;
  v_den numeric;
  v_num numeric;
  v_sum_num numeric;
  v_total integer;
  v_incomplete boolean;
  v_result numeric;
  v_target numeric;
  v_value text;
  v_status text;
  v_actor uuid := coalesce(p_recorded_by, auth.uid());
begin
  if p_input_kpi_id is null or p_report_date is null then
    return;
  end if;

  for v_calc in
    select distinct
      c.id,
      c.calc_denominator_kpi_id,
      c.direction,
      c.tolerance_type,
      c.green_tolerance,
      c.yellow_tolerance,
      c.target_value,
      c.calc_effective_from
    from public.kpis c
    left join public.kpi_calc_sum_numerators n
      on n.parent_kpi_id = c.id
    where c.archived_at is null
      and c.kpi_kind = 'TARGET'
      and c.calc_operator = 'SUM_DIVIDE'
      and c.calc_denominator_kpi_id is not null
      and p_report_date >= c.calc_effective_from
      and (
        c.calc_denominator_kpi_id = p_input_kpi_id
        or n.numerator_kpi_id = p_input_kpi_id
      )
  loop
    select h.value
    into v_den_text
    from public.kpi_history h
    where h.kpi_id = v_calc.calc_denominator_kpi_id
      and h.report_date = p_report_date
      and h.archived_at is null
    limit 1;

    v_den := public.parse_kpi_numeric_text(v_den_text);
    v_sum_num := 0;
    v_total := 0;
    v_incomplete := v_den is null or v_den = 0;

    for v_num_row in
      select n.numerator_kpi_id
      from public.kpi_calc_sum_numerators n
      where n.parent_kpi_id = v_calc.id
      order by n.sort_order, n.created_at
    loop
      v_total := v_total + 1;

      select h.value
      into v_num_text
      from public.kpi_history h
      where h.kpi_id = v_num_row.numerator_kpi_id
        and h.report_date = p_report_date
        and h.archived_at is null
      limit 1;

      v_num := public.parse_kpi_numeric_text(v_num_text);
      if v_num is null then
        v_incomplete := true;
      else
        v_sum_num := v_sum_num + v_num;
      end if;
    end loop;

    if v_incomplete or v_total = 0 then
      perform public.write_computed_kpi_value(
        v_calc.id,
        p_report_date,
        '—',
        'Gul',
        'Beräknad – saknar komplett underlag',
        v_actor
      );
      continue;
    end if;

    v_result := v_sum_num / v_den;
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
      p_report_date,
      v_value,
      v_status,
      'Beräknad',
      v_actor
    );
  end loop;
end;
$$;

comment on function public.recalculate_target_sum_divide_kpis(uuid, date, uuid) is
  'Recomputes system TARGET SUM_DIVIDE KPIs from active same-day source rows and applies configured G/Y/R thresholds.';

create or replace function public.trigger_recalculate_target_sum_divide_kpis()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.report_date is not null
     and (
       tg_op = 'INSERT'
       or old.value is distinct from new.value
       or old.report_date is distinct from new.report_date
       or old.archived_at is distinct from new.archived_at
     ) then
    perform public.recalculate_target_sum_divide_kpis(
      new.kpi_id,
      new.report_date,
      new.recorded_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists kpi_history_recalculate_target_sum_divide
  on public.kpi_history;
create trigger kpi_history_recalculate_target_sum_divide
  after insert or update of value, report_date, archived_at
  on public.kpi_history
  for each row
  execute function public.trigger_recalculate_target_sum_divide_kpis();

do $$
declare
  v_area_id uuid;
  v_productivity_id uuid;
  v_hours_id uuid;
  v_source_names text[];
begin
  select ba.id
  into v_area_id
  from public.business_areas ba
  where ba.slug = 'lager-logistik'
  limit 1;

  if v_area_id is null then
    raise exception 'Lager & Logistik business area not found';
  end if;

  select k.id, k.calc_denominator_kpi_id
  into v_productivity_id, v_hours_id
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Kolli per arbetad timme'
    and k.calc_operator = 'SUM_DIVIDE'
    and k.archived_at is null
  limit 1;

  if v_productivity_id is null or v_hours_id is null then
    raise exception 'Active Lager productivity KPI or denominator not found';
  end if;

  if not exists (
    select 1
    from public.kpis k
    where k.id = v_hours_id
      and k.business_area_id = v_area_id
      and k.name = 'Arbetade timmar'
      and k.kpi_kind = 'STATISTIC'
      and k.archived_at is null
  ) then
    raise exception 'Active Lager Arbetade timmar source not found';
  end if;

  select array_agg(k.name order by n.sort_order)
  into v_source_names
  from public.kpi_calc_sum_numerators n
  join public.kpis k on k.id = n.numerator_kpi_id
  where n.parent_kpi_id = v_productivity_id
    and k.business_area_id = v_area_id
    and k.kpi_kind = 'STATISTIC'
    and k.archived_at is null;

  if v_source_names is distinct from array['Kolli OOH', 'Kolli Byggmax']::text[] then
    raise exception 'Expected Lager Kolli OOH and Kolli Byggmax sources not found';
  end if;

  update public.kpis
  set kpi_kind = 'TARGET',
      target_value = '100',
      unit = 'kolli/timme',
      current_value = case
        when kpi_kind = 'TARGET' then current_value
        else null
      end,
      status = case
        when kpi_kind = 'TARGET' then status
        else 'Gul'
      end,
      direction = 'HIGHER_IS_BETTER',
      tolerance_type = 'ABSOLUTE',
      green_tolerance = null,
      yellow_tolerance = 10,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = v_hours_id,
      calc_effective_from = coalesce(
        calc_effective_from,
        (now() at time zone 'Europe/Stockholm')::date
      ),
      reporting_frequency = 'DAILY',
      updated_at = now()
  where id = v_productivity_id
    and (
      kpi_kind is distinct from 'TARGET'
      or target_value is distinct from '100'
      or unit is distinct from 'kolli/timme'
      or direction is distinct from 'HIGHER_IS_BETTER'
      or tolerance_type is distinct from 'ABSOLUTE'
      or green_tolerance is not null
      or yellow_tolerance is distinct from 10
      or calc_numerator_kpi_id is not null
      or calc_denominator_kpi_id is distinct from v_hours_id
      or calc_effective_from is null
      or reporting_frequency is distinct from 'DAILY'
    );

  -- Deliberately no backfill: existing calculated history remains immutable.
  -- The trigger above creates or corrects TARGET history only for report dates
  -- on or after the preserved production cutover date.
end;
$$;
