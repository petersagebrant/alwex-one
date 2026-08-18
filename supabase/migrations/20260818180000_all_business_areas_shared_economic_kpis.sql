-- Roll the shared economic KPI model out to every operational business area.
-- Alwex totalt is synthetic and deliberately excluded.
-- Existing KPI/history rows are reused or soft-archived; nothing is deleted.

do $$
declare
  v_area record;
  v_daily_id uuid;
  v_mtd_id uuid;
  v_result_id uuid;
begin
  for v_area in
    select ba.id, ba.name, ba.slug
    from public.business_areas ba
    where ba.slug <> 'alwex-totalt'
      and lower(btrim(ba.name)) <> 'alwex totalt'
  loop
    -- Prefer the canonical row, then the legacy exact name. This preserves the
    -- Fjärr & Miljö revenue history and safely reuses equivalent rows elsewhere.
    select k.id
    into v_daily_id
    from public.kpis k
    where k.business_area_id = v_area.id
      and k.name in ('Omsättning idag', 'Omsättning')
      and k.archived_at is null
    order by
      case when k.name = 'Omsättning idag' then 0 else 1 end,
      (select count(*) from public.kpi_history h where h.kpi_id = k.id) desc,
      k.created_at
    limit 1;

    if v_daily_id is null then
      insert into public.kpis (
        business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance, reporting_frequency
      )
      values (
        v_area.id, 'Omsättning idag', 'Ekonomi', null, null, 'kr',
        'Statistik', 'Oförändrad', 'STATISTIC', null, null,
        null, null, 'DAILY'
      )
      returning id into v_daily_id;
    else
      update public.kpis
      set name = 'Omsättning idag',
          category = 'Ekonomi',
          unit = 'kr',
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
          reporting_frequency = 'DAILY',
          updated_at = now()
      where id = v_daily_id;
    end if;

    -- Any second exact legacy revenue row is replaced by the reused canonical
    -- input. Soft archive it so its history remains available.
    update public.kpis
    set archived_at = coalesce(archived_at, now()), updated_at = now()
    where business_area_id = v_area.id
      and id <> v_daily_id
      and name in ('Omsättning idag', 'Omsättning')
      and archived_at is null;

    select k.id
    into v_mtd_id
    from public.kpis k
    where k.business_area_id = v_area.id
      and k.name = 'Omsättning månad hittills'
      and k.archived_at is null
    order by
      (select count(*) from public.kpi_history h where h.kpi_id = k.id) desc,
      k.created_at
    limit 1;

    if v_mtd_id is null then
      insert into public.kpis (
        business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance, calc_operator,
        calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
      )
      values (
        v_area.id, 'Omsättning månad hittills', 'Ekonomi', null, null, 'kr',
        'Statistik', 'Oförändrad', 'CALCULATED', null, null,
        null, null, 'MONTH_TO_DATE_SUM', v_daily_id, null, 'DAILY'
      )
      returning id into v_mtd_id;
    else
      update public.kpis
      set category = 'Ekonomi',
          unit = 'kr',
          kpi_kind = 'CALCULATED',
          status = 'Statistik',
          target_value = null,
          direction = null,
          tolerance_type = null,
          green_tolerance = null,
          yellow_tolerance = null,
          calc_operator = 'MONTH_TO_DATE_SUM',
          calc_numerator_kpi_id = v_daily_id,
          calc_denominator_kpi_id = null,
          reporting_frequency = 'DAILY',
          updated_at = now()
      where id = v_mtd_id;
    end if;

    select k.id
    into v_result_id
    from public.kpis k
    where k.business_area_id = v_area.id
      and k.name = 'Resultat mot budget'
      and k.archived_at is null
    order by
      (select count(*) from public.kpi_history h where h.kpi_id = k.id) desc,
      k.created_at
    limit 1;

    if v_result_id is null then
      insert into public.kpis (
        business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance, reporting_frequency
      )
      values (
        v_area.id, 'Resultat mot budget', 'Ekonomi', '0', null, 'Mkr',
        'Gul', 'Oförändrad', 'TARGET', 'HIGHER_IS_BETTER', 'ABSOLUTE',
        null, 0.2, 'MONTHLY'
      )
      returning id into v_result_id;
    else
      update public.kpis
      set category = 'Ekonomi',
          unit = 'Mkr',
          kpi_kind = 'TARGET',
          target_value = '0',
          direction = 'HIGHER_IS_BETTER',
          tolerance_type = 'ABSOLUTE',
          green_tolerance = null,
          yellow_tolerance = 0.2,
          calc_operator = null,
          calc_numerator_kpi_id = null,
          calc_denominator_kpi_id = null,
          reporting_frequency = 'MONTHLY',
          updated_at = now()
      where id = v_result_id;
    end if;

    update public.kpis
    set archived_at = coalesce(archived_at, now()), updated_at = now()
    where business_area_id = v_area.id
      and id <> v_result_id
      and name = 'Resultat mot budget'
      and archived_at is null;

    -- These are the known superseded demo economic targets. Keep the rows and
    -- their history, but do not let them compete with the shared model.
    update public.kpis
    set archived_at = coalesce(archived_at, now()), updated_at = now()
    where business_area_id = v_area.id
      and category = 'Ekonomi'
      and name in ('Budgetavvikelse', 'Omsättning mot budget')
      and archived_at is null;

    perform public.recalculate_month_to_date_kpis(v_daily_id, h.report_date, null)
    from (
      select min(kh.report_date) as report_date
      from public.kpi_history kh
      where kh.kpi_id = v_daily_id
        and kh.report_date is not null
      group by date_trunc('month', kh.report_date)
    ) h
    where h.report_date is not null;
  end loop;
end;
$$;

-- Keep one inferred accounting period per legacy result/month. Operands stay
-- null so old deviation-only rows remain explicitly legacy.
with candidates as (
  select
    h.id,
    (date_trunc('month', h.recorded_at at time zone 'Europe/Stockholm')
      - interval '1 month')::date as inferred_period,
    row_number() over (
      partition by h.kpi_id,
        (date_trunc('month', h.recorded_at at time zone 'Europe/Stockholm')
          - interval '1 month')::date
      order by h.recorded_at desc, h.created_at desc, h.id desc
    ) as rn
  from public.kpi_history h
  join public.kpis k on k.id = h.kpi_id
  join public.business_areas ba on ba.id = k.business_area_id
  where k.name = 'Resultat mot budget'
    and ba.slug <> 'alwex-totalt'
    and lower(btrim(ba.name)) <> 'alwex totalt'
    and h.period_month is null
)
update public.kpi_history h
set period_month = c.inferred_period,
    report_date = null
from candidates c
where h.id = c.id
  and c.rn = 1
  and not exists (
    select 1
    from public.kpi_history existing
    where existing.kpi_id = h.kpi_id
      and existing.period_month = c.inferred_period
  );
