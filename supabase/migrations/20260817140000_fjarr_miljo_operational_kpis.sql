-- Fjärr & Miljö operational KPIs (2026-08-17)
-- Add Omsättning + Körda mil (STATISTIC DAILY) and Kr per mil (CALCULATED DIVIDE).
-- Keep archived seed leftovers, sick triad, and Resultat MONTHLY unchanged.
-- Do not touch Kyl & Frys or Lager & Logistik.

do $$
declare
  v_area_id uuid := 'a30b9d4d-d9d7-4975-b7da-413c907e5c3a';
  v_omsattning uuid;
  v_korda_mil uuid;
  v_kr_per_mil uuid;
begin
  if not exists (select 1 from public.business_areas where id = v_area_id) then
    select ba.id
    into v_area_id
    from public.business_areas as ba
    where ba.slug = 'fjarr-miljo' or ba.name = 'Fjärr & Miljö'
    limit 1;
  end if;

  if v_area_id is null then
    raise notice 'Fjärr & Miljö not found — skipping operational KPI updates';
    return;
  end if;

  -- 1) Omsättning — STATISTIC, DAILY, unit kr (manual, no G/Y/R)
  select k.id into v_omsattning
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Omsättning'
    and k.archived_at is null
  limit 1;

  if v_omsattning is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Omsättning', 'Ekonomi', null, null, 'kr',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, 'DAILY'
    )
    returning id into v_omsattning;
  else
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'kr'),
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      category = coalesce(nullif(btrim(category), ''), 'Ekonomi'),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = 'DAILY',
      updated_at = now()
    where id = v_omsattning;
  end if;

  -- 2) Körda mil — STATISTIC, DAILY, unit mil (manual, no G/Y/R)
  select k.id into v_korda_mil
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Körda mil'
    and k.archived_at is null
  limit 1;

  if v_korda_mil is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area_id, 'Körda mil', 'Volym', null, null, 'mil',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, 'DAILY'
    )
    returning id into v_korda_mil;
  else
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'mil'),
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
    where id = v_korda_mil;
  end if;

  -- 3) Kr per mil — CALCULATED DIVIDE = Omsättning / Körda mil (not manual, not daily progress)
  select k.id into v_kr_per_mil
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Kr per mil'
    and k.archived_at is null
  limit 1;

  if v_kr_per_mil is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance,
      calc_operator, calc_numerator_kpi_id, calc_denominator_kpi_id,
      reporting_frequency
    )
    values (
      v_area_id, 'Kr per mil', 'Produktivitet', null, null, 'kr/mil',
      'Statistik', 'Oförändrad', 'CALCULATED', null, null,
      null, null,
      'DIVIDE', v_omsattning, v_korda_mil,
      'DAILY'
    )
    returning id into v_kr_per_mil;
  else
    update public.kpis
    set
      kpi_kind = 'CALCULATED',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'kr/mil'),
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      category = coalesce(nullif(btrim(category), ''), 'Produktivitet'),
      calc_operator = 'DIVIDE',
      calc_numerator_kpi_id = v_omsattning,
      calc_denominator_kpi_id = v_korda_mil,
      reporting_frequency = 'DAILY',
      updated_at = now()
    where id = v_kr_per_mil;
  end if;
end;
$$;
