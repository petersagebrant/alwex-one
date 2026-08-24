-- Recycling volume: inbound vs outbound tonnes.
-- Rename the existing inbound pair in place (keep UUIDs). Add a matching
-- outbound pair. Reuse the existing calendar-month sum infrastructure as-is.
-- No history backfill; testdata is not restored.

do $$
declare
  v_area_id uuid;
  v_ton_in_daily_id uuid := '51a8c0c9-7413-4dd6-9e12-b9a88cb54617';
  v_ton_in_mtd_id uuid := '3d58a76d-7223-42f7-abb4-ad971e15a469';
  v_ton_out_daily_id uuid := 'eef11132-7c3a-46f9-9e16-c7b759dbc461';
  v_ton_out_mtd_id uuid := '50dc56f6-39f7-46b3-b2ea-0fb09014349f';
begin
  select ba.id
  into v_area_id
  from public.business_areas ba
  where ba.slug = 'recycling'
  limit 1;

  if v_area_id is null then
    raise exception 'Recycling business area not found';
  end if;

  -- Prefer the canonical inbound UUIDs. Fall back to the previous active
  -- names if this database generated different ids (local).
  if not exists (
    select 1
    from public.kpis k
    where k.id = v_ton_in_daily_id
      and k.business_area_id = v_area_id
  ) then
    select k.id
    into v_ton_in_daily_id
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.name in ('Ton idag', 'Ton in idag')
      and k.archived_at is null
    order by k.created_at
    limit 1;
  end if;

  if v_ton_in_daily_id is null then
    raise exception 'Recycling Ton in idag KPI not found';
  end if;

  if not exists (
    select 1
    from public.kpis k
    where k.id = v_ton_in_mtd_id
      and k.business_area_id = v_area_id
  ) then
    select k.id
    into v_ton_in_mtd_id
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.name in ('Ton månad hittills', 'Ton in månad hittills')
      and k.archived_at is null
    order by k.created_at
    limit 1;
  end if;

  if v_ton_in_mtd_id is null then
    raise exception 'Recycling Ton in månad hittills KPI not found';
  end if;

  -- Keep UUIDs. Unique index kpis_business_area_id_name_active_uidx allows
  -- the new names. Do not toggle archived_at.
  update public.kpis
  set name = 'Ton in idag',
      category = 'Volym',
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
  where id = v_ton_in_daily_id
    and business_area_id = v_area_id;

  update public.kpis
  set name = 'Ton in månad hittills',
      category = 'Volym',
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
      calc_numerator_kpi_id = v_ton_in_daily_id,
      calc_denominator_kpi_id = null,
      reporting_frequency = 'DAILY',
      updated_at = now()
  where id = v_ton_in_mtd_id
    and business_area_id = v_area_id;

  -- Ton ut idag: manual daily input, no target.
  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_ton_out_daily_id or k.name = 'Ton ut idag')
  ) then
    insert into public.kpis (
      id, business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_ton_out_daily_id, v_area_id, 'Ton ut idag', 'Volym', null, null, 'ton',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, null, null, null, 'DAILY'
    );
  else
    select k.id
    into v_ton_out_daily_id
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_ton_out_daily_id or k.name = 'Ton ut idag')
    order by case when k.id = v_ton_out_daily_id then 0 else 1 end
    limit 1;
  end if;

  -- Ton ut månad hittills: automatic calendar-month sum of Ton ut idag.
  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_ton_out_mtd_id or k.name = 'Ton ut månad hittills')
  ) then
    insert into public.kpis (
      id, business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_ton_out_mtd_id, v_area_id, 'Ton ut månad hittills', 'Volym', null, null, 'ton',
      'Statistik', 'Oförändrad', 'CALCULATED', null, null,
      null, null, 'MONTH_TO_DATE_SUM', v_ton_out_daily_id, null, 'DAILY'
    );
  end if;
end;
$$;
