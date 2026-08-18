-- Mark & Anläggning operational KPIs (2026-08-18)
-- Add Ton ut Snugge, Kubik ut Betongstationen, Antal enheter i drift (STATISTIC DAILY).
-- Keep existing active KPIs (Budgetavvikelse, sick triad) unchanged.
-- Do not touch Kyl & Frys, Lager & Logistik, or Fjärr & Miljö.

do $$
declare
  v_area_id uuid := '550a4dc4-97a6-48fb-99b8-ef2e4c16b5a7';
  v_ton_snugge uuid;
  v_kubik_betong uuid;
  v_enheter_drift uuid;
begin
  if not exists (select 1 from public.business_areas where id = v_area_id) then
    select ba.id
    into v_area_id
    from public.business_areas as ba
    where ba.slug = 'mark-anlaggning' or ba.name = 'Mark & Anläggning'
    limit 1;
  end if;

  if v_area_id is null then
    raise notice 'Mark & Anläggning not found — skipping operational KPI updates';
    return;
  end if;

  -- 1) Ton ut Snugge — STATISTIC, DAILY, unit ton (manual, no G/Y/R)
  select k.id into v_ton_snugge
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Ton ut Snugge'
    and k.archived_at is null
  limit 1;

  if v_ton_snugge is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Ton ut Snugge', 'Volym', null, null, 'ton',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, 'DAILY'
    )
    returning id into v_ton_snugge;
  else
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'ton'),
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
    where id = v_ton_snugge;
  end if;

  -- 2) Kubik ut Betongstationen — STATISTIC, DAILY, unit m³ (manual, no G/Y/R)
  select k.id into v_kubik_betong
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Kubik ut Betongstationen'
    and k.archived_at is null
  limit 1;

  if v_kubik_betong is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Kubik ut Betongstationen', 'Volym', null, null, 'm³',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, 'DAILY'
    )
    returning id into v_kubik_betong;
  else
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'm³'),
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
    where id = v_kubik_betong;
  end if;

  -- 3) Antal enheter i drift — STATISTIC, DAILY, unit st (manual, no G/Y/R)
  select k.id into v_enheter_drift
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Antal enheter i drift'
    and k.archived_at is null
  limit 1;

  if v_enheter_drift is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Antal enheter i drift', 'Drift', null, null, 'st',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, 'DAILY'
    )
    returning id into v_enheter_drift;
  else
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'st'),
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      category = coalesce(nullif(btrim(category), ''), 'Drift'),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = 'DAILY',
      updated_at = now()
    where id = v_enheter_drift;
  end if;
end;
$$;
