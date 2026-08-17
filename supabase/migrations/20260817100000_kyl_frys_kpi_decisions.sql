-- Kyl & Frys KPI decisions (2026-08-17)
-- Preserve all history rows. Do not delete seed/snapshot values.
-- Only correct definition fields (target/direction/unit) and ensure
-- placeholder history cannot count as today's reporting (report_date null).

do $$
declare
  v_area_id uuid := 'cd3371ca-1bc5-4dbc-b968-3562fb9baac6';
  -- Inventory KPI ids (Kyl & Frys)
  v_leveransprecision uuid := '945135b2-1826-45e7-aca6-77f5c099ab77';
  v_resultat uuid := 'd6f964f4-7cad-4512-b55d-4e0600f57333';
  v_fyllnadsgrad uuid := '3dca730a-71e1-4e06-a486-c5a93bd87d9f';
  v_antal_rc uuid := 'e8497bb3-e3d2-4ade-9109-1fc48acd5766';
  v_per_rc uuid := '7ebc2493-7ffd-4a98-a10d-e6b2141c9936';
  v_korda_mil uuid := '7798123d-dbe0-4f94-aab1-d4331c850f8e';
begin
  -- Resolve area by id or name (safe if inventory id differs in some envs)
  if not exists (select 1 from public.business_areas where id = v_area_id) then
    select ba.id
    into v_area_id
    from public.business_areas as ba
    where ba.slug = 'kyl-frys' or ba.name = 'Kyl & Frys'
    limit 1;
  end if;

  if v_area_id is null then
    raise notice 'Kyl & Frys not found — skipping KPI decision updates';
    return;
  end if;

  -- 1) Leveransprecision — TARGET, mål 97 % (99 % was outcome, not target)
  update public.kpis
  set
    kpi_kind = 'TARGET',
    target_value = '97',
    unit = coalesce(nullif(btrim(unit), ''), '%'),
    direction = 'HIGHER_IS_BETTER',
    tolerance_type = 'ABSOLUTE',
    yellow_tolerance = coalesce(yellow_tolerance, 2),
    calc_operator = null,
    calc_numerator_kpi_id = null,
    calc_denominator_kpi_id = null,
    updated_at = now()
  where id = v_leveransprecision
    and business_area_id = v_area_id
    and archived_at is null;

  -- Fallback by name if id missing in this environment
  if not found then
    update public.kpis
    set
      kpi_kind = 'TARGET',
      target_value = '97',
      unit = coalesce(nullif(btrim(unit), ''), '%'),
      direction = 'HIGHER_IS_BETTER',
      tolerance_type = 'ABSOLUTE',
      yellow_tolerance = coalesce(yellow_tolerance, 2),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      updated_at = now()
    where business_area_id = v_area_id
      and name = 'Leveransprecision'
      and archived_at is null;
  end if;

  -- 2) Resultat mot budget — target 0 Mkr; positive is good (HIGHER_IS_BETTER)
  update public.kpis
  set
    kpi_kind = 'TARGET',
    target_value = '0',
    unit = coalesce(nullif(btrim(unit), ''), 'Mkr'),
    direction = 'HIGHER_IS_BETTER',
    tolerance_type = 'ABSOLUTE',
    yellow_tolerance = coalesce(yellow_tolerance, 0.2),
    calc_operator = null,
    calc_numerator_kpi_id = null,
    calc_denominator_kpi_id = null,
    updated_at = now()
  where id = v_resultat
    and business_area_id = v_area_id
    and archived_at is null;

  if not found then
    update public.kpis
    set
      kpi_kind = 'TARGET',
      target_value = '0',
      unit = coalesce(nullif(btrim(unit), ''), 'Mkr'),
      direction = 'HIGHER_IS_BETTER',
      tolerance_type = 'ABSOLUTE',
      yellow_tolerance = coalesce(yellow_tolerance, 0.2),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      updated_at = now()
    where business_area_id = v_area_id
      and name = 'Resultat mot budget'
      and archived_at is null;
  end if;

  -- 4) Fyllnadsgrad — keep TARGET 90 %, manual; clear placeholder current_value
  update public.kpis
  set
    kpi_kind = 'TARGET',
    target_value = '90',
    unit = coalesce(nullif(btrim(unit), ''), '%'),
    direction = 'HIGHER_IS_BETTER',
    tolerance_type = coalesce(tolerance_type, 'ABSOLUTE'),
    yellow_tolerance = coalesce(yellow_tolerance, 5),
    current_value = case
      when current_value is null then null
      when btrim(current_value) in ('', '—', '-', '–') then null
      else current_value
    end,
    calc_operator = null,
    calc_numerator_kpi_id = null,
    calc_denominator_kpi_id = null,
    updated_at = now()
  where id = v_fyllnadsgrad
    and business_area_id = v_area_id
    and archived_at is null;

  if not found then
    update public.kpis
    set
      kpi_kind = 'TARGET',
      target_value = '90',
      unit = coalesce(nullif(btrim(unit), ''), '%'),
      direction = 'HIGHER_IS_BETTER',
      tolerance_type = coalesce(tolerance_type, 'ABSOLUTE'),
      yellow_tolerance = coalesce(yellow_tolerance, 5),
      current_value = case
        when current_value is null then null
        when btrim(current_value) in ('', '—', '-', '–') then null
        else current_value
      end,
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      updated_at = now()
    where business_area_id = v_area_id
      and name = 'Fyllnadsgrad'
      and archived_at is null;
  end if;

  -- Keep placeholder history rows, but never let them look like today's report.
  update public.kpi_history as h
  set report_date = null
  where h.kpi_id in (
      select k.id
      from public.kpis as k
      where k.business_area_id = v_area_id
        and k.name = 'Fyllnadsgrad'
        and k.archived_at is null
    )
    and (
      h.value is null
      or btrim(h.value) in ('', '—', '-', '–')
    )
    and h.report_date is not null;

  -- 6) Antal RC — unit RC (not st), STATISTIC
  update public.kpis
  set
    kpi_kind = 'STATISTIC',
    status = 'Statistik',
    unit = 'RC',
    target_value = null,
    direction = null,
    tolerance_type = null,
    green_tolerance = null,
    yellow_tolerance = null,
    calc_operator = null,
    calc_numerator_kpi_id = null,
    calc_denominator_kpi_id = null,
    updated_at = now()
  where id = v_antal_rc
    and business_area_id = v_area_id
    and archived_at is null;

  if not found then
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = 'RC',
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      updated_at = now()
    where business_area_id = v_area_id
      and name = 'Antal RC'
      and archived_at is null;
  end if;

  -- 3) Körda mil per RC — verify CALCULATED DIVIDE (no target / G/Y/R)
  update public.kpis
  set
    kpi_kind = 'CALCULATED',
    status = 'Statistik',
    target_value = null,
    direction = null,
    tolerance_type = null,
    green_tolerance = null,
    yellow_tolerance = null,
    unit = coalesce(nullif(btrim(unit), ''), 'mil/RC'),
    calc_operator = 'DIVIDE',
    calc_numerator_kpi_id = coalesce(
      calc_numerator_kpi_id,
      (
        select k.id
        from public.kpis as k
        where k.business_area_id = v_area_id
          and k.name = 'Körda mil'
          and k.archived_at is null
        limit 1
      )
    ),
    calc_denominator_kpi_id = coalesce(
      calc_denominator_kpi_id,
      (
        select k.id
        from public.kpis as k
        where k.business_area_id = v_area_id
          and k.name = 'Antal RC'
          and k.archived_at is null
        limit 1
      )
    ),
    updated_at = now()
  where (
      id = v_per_rc
      or name = 'Körda mil per RC'
    )
    and business_area_id = v_area_id
    and archived_at is null;

  -- Keep Körda mil as STATISTIC input (no definition drift)
  update public.kpis
  set
    kpi_kind = 'STATISTIC',
    status = 'Statistik',
    target_value = null,
    direction = null,
    tolerance_type = null,
    green_tolerance = null,
    yellow_tolerance = null,
    unit = coalesce(nullif(btrim(unit), ''), 'mil'),
    calc_operator = null,
    calc_numerator_kpi_id = null,
    calc_denominator_kpi_id = null,
    updated_at = now()
  where (
      id = v_korda_mil
      or name = 'Körda mil'
    )
    and business_area_id = v_area_id
    and archived_at is null;
end;
$$;
