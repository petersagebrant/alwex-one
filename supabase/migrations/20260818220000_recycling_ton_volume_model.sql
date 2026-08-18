-- Recycling volume reporting in actual tonnes.
-- Keep the legacy percentage KPI and all its history, but exclude it from
-- active views. Reuse the generic MONTH_TO_DATE_SUM infrastructure.

-- MTD sums must never include soft-archived source history.
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
  v_value text;
  v_actor uuid := coalesce(p_recorded_by, auth.uid());
begin
  if p_input_kpi_id is null or p_changed_date is null then
    return;
  end if;

  for v_calc in
    select c.id
    from public.kpis c
    where c.kpi_kind = 'CALCULATED'
      and c.calc_operator = 'MONTH_TO_DATE_SUM'
      and c.calc_numerator_kpi_id = p_input_kpi_id
      and c.archived_at is null
  loop
    for v_date in
      select distinct d.report_date
      from (
        select p_changed_date as report_date
        union all
        select h.report_date
        from public.kpi_history h
        where h.kpi_id = p_input_kpi_id
          and h.report_date >= p_changed_date
          and h.report_date < (
            date_trunc('month', p_changed_date) + interval '1 month'
          )::date
      ) d
      where d.report_date is not null
      order by d.report_date
    loop
      select sum(public.parse_kpi_numeric_text(h.value))
      into v_sum
      from public.kpi_history h
      where h.kpi_id = p_input_kpi_id
        and h.report_date >= date_trunc('month', v_date)::date
        and h.report_date <= v_date
        and h.archived_at is null
        and public.parse_kpi_numeric_text(h.value) is not null;

      if v_sum is null then
        continue;
      end if;

      v_value := public.format_kpi_numeric_sv(v_sum);
      perform public.write_computed_kpi_value(
        v_calc.id,
        v_date,
        v_value,
        'Statistik',
        'Beräknad månad hittills',
        v_actor
      );
    end loop;
  end loop;
end;
$$;

comment on function public.recalculate_month_to_date_kpis(uuid, date, uuid) is
  'Recomputes reusable MONTH_TO_DATE_SUM history from active source rows only.';

-- Archiving or reactivating a source row must recalculate its affected MTD.
create or replace function public.trigger_recalculate_month_to_date_kpis()
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
    perform public.recalculate_month_to_date_kpis(
      new.kpi_id,
      new.report_date,
      new.recorded_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists kpi_history_recalculate_month_to_date
  on public.kpi_history;
create trigger kpi_history_recalculate_month_to_date
  after insert or update of value, report_date, archived_at
  on public.kpi_history
  for each row
  execute function public.trigger_recalculate_month_to_date_kpis();

do $$
declare
  v_area_id uuid;
  v_ton_daily_id uuid;
  v_ton_mtd_id uuid;
begin
  select ba.id
  into v_area_id
  from public.business_areas ba
  where ba.slug = 'recycling'
  limit 1;

  if v_area_id is null then
    raise exception 'Recycling business area not found';
  end if;

  -- Migrations run without auth.uid(); bypass only the user-facing archive
  -- guard while this transaction soft-archives superseded Recycling rows.
  alter table public.kpis
    disable trigger kpis_prevent_unauthorized_archive;

  -- Ton idag: manual raw-data input with no target or traffic-light status.
  select k.id
  into v_ton_daily_id
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Ton idag'
    and k.archived_at is null
  order by
    (select count(*) from public.kpi_history h where h.kpi_id = k.id) desc,
    k.created_at
  limit 1;

  if v_ton_daily_id is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_area_id, 'Ton idag', 'Volym', null, null, 'ton',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, null, null, null, 'DAILY'
    )
    returning id into v_ton_daily_id;
  else
    update public.kpis
    set category = 'Volym',
        unit = 'ton',
        status = 'Statistik',
        trend = 'Oförändrad',
        kpi_kind = 'STATISTIC',
        target_value = null,
        direction = null,
        tolerance_type = null,
        green_tolerance = null,
        yellow_tolerance = null,
        calc_operator = null,
        calc_numerator_kpi_id = null,
        calc_denominator_kpi_id = null,
        reporting_frequency = 'DAILY',
        updated_at = now()
    where id = v_ton_daily_id;
  end if;

  update public.kpis
  set archived_at = coalesce(archived_at, now()), updated_at = now()
  where business_area_id = v_area_id
    and id <> v_ton_daily_id
    and name = 'Ton idag'
    and archived_at is null;

  -- Ton månad hittills: automatic calendar-month sum of Ton idag.
  select k.id
  into v_ton_mtd_id
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Ton månad hittills'
    and k.archived_at is null
  order by
    (select count(*) from public.kpi_history h where h.kpi_id = k.id) desc,
    k.created_at
  limit 1;

  if v_ton_mtd_id is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_area_id, 'Ton månad hittills', 'Volym', null, null, 'ton',
      'Statistik', 'Oförändrad', 'CALCULATED', null, null,
      null, null, 'MONTH_TO_DATE_SUM', v_ton_daily_id, null, 'DAILY'
    )
    returning id into v_ton_mtd_id;
  else
    update public.kpis
    set category = 'Volym',
        unit = 'ton',
        status = 'Statistik',
        trend = 'Oförändrad',
        kpi_kind = 'CALCULATED',
        target_value = null,
        direction = null,
        tolerance_type = null,
        green_tolerance = null,
        yellow_tolerance = null,
        calc_operator = 'MONTH_TO_DATE_SUM',
        calc_numerator_kpi_id = v_ton_daily_id,
        calc_denominator_kpi_id = null,
        reporting_frequency = 'DAILY',
        updated_at = now()
    where id = v_ton_mtd_id;
  end if;

  update public.kpis
  set archived_at = coalesce(archived_at, now()), updated_at = now()
  where business_area_id = v_area_id
    and id <> v_ton_mtd_id
    and name = 'Ton månad hittills'
    and archived_at is null;

  -- Preserve the percentage KPI and every history row; only remove the KPI
  -- from operational queries by soft-archiving its definition.
  update public.kpis
  set archived_at = coalesce(archived_at, now()), updated_at = now()
  where business_area_id = v_area_id
    and name = 'Volymutveckling'
    and archived_at is null;

  alter table public.kpis
    enable trigger kpis_prevent_unauthorized_archive;
end;
$$;
