-- Mark & Anläggning: Tunatorp inbound/outbound tonnes.
-- INSERT only. Does not update or delete existing KPI rows.
-- Reuse the existing calendar-month sum infrastructure as-is. No history backfill.

do $$
declare
  v_area_id uuid := '550a4dc4-97a6-48fb-99b8-ef2e4c16b5a7';
  v_ton_in_daily_id uuid := 'c84cd886-832a-46df-b395-e16cbdeca55d';
  v_ton_in_mtd_id uuid := '6b396a9f-7636-4f28-9dc2-476a06410fce';
  v_ton_out_daily_id uuid := 'eaa9a37f-f2a1-4634-ac7f-c3dbe33e3d20';
  v_ton_out_mtd_id uuid := 'c8499840-1b0c-41a4-afd8-3ea0acf12a17';
begin
  if not exists (select 1 from public.business_areas where id = v_area_id) then
    select ba.id
    into v_area_id
    from public.business_areas ba
    where ba.slug = 'mark-anlaggning'
    limit 1;
  end if;

  if v_area_id is null then
    raise exception 'Mark & Anläggning business area not found';
  end if;

  -- Ton in Tunatorp: manual daily input, no target.
  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_ton_in_daily_id or k.name = 'Ton in Tunatorp')
  ) then
    insert into public.kpis (
      id, business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_ton_in_daily_id, v_area_id, 'Ton in Tunatorp', 'Volym', null, null, 'ton',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, null, null, null, 'DAILY'
    );
  else
    select k.id
    into v_ton_in_daily_id
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_ton_in_daily_id or k.name = 'Ton in Tunatorp')
    order by case when k.id = v_ton_in_daily_id then 0 else 1 end
    limit 1;
  end if;

  -- Ton in Tunatorp månad hittills: automatic calendar-month sum.
  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_ton_in_mtd_id or k.name = 'Ton in Tunatorp månad hittills')
  ) then
    insert into public.kpis (
      id, business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_ton_in_mtd_id, v_area_id, 'Ton in Tunatorp månad hittills', 'Volym',
      null, null, 'ton',
      'Statistik', 'Oförändrad', 'CALCULATED', null, null,
      null, null, 'MONTH_TO_DATE_SUM', v_ton_in_daily_id, null, 'DAILY'
    );
  end if;

  -- Ton ut Tunatorp: manual daily input, no target.
  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_ton_out_daily_id or k.name = 'Ton ut Tunatorp')
  ) then
    insert into public.kpis (
      id, business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_ton_out_daily_id, v_area_id, 'Ton ut Tunatorp', 'Volym', null, null, 'ton',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, null, null, null, 'DAILY'
    );
  else
    select k.id
    into v_ton_out_daily_id
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_ton_out_daily_id or k.name = 'Ton ut Tunatorp')
    order by case when k.id = v_ton_out_daily_id then 0 else 1 end
    limit 1;
  end if;

  -- Ton ut Tunatorp månad hittills: automatic calendar-month sum.
  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_ton_out_mtd_id or k.name = 'Ton ut Tunatorp månad hittills')
  ) then
    insert into public.kpis (
      id, business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_ton_out_mtd_id, v_area_id, 'Ton ut Tunatorp månad hittills', 'Volym',
      null, null, 'ton',
      'Statistik', 'Oförändrad', 'CALCULATED', null, null,
      null, null, 'MONTH_TO_DATE_SUM', v_ton_out_daily_id, null, 'DAILY'
    );
  end if;
end;
$$;
