-- Fjärr & Miljö KPI decisions (2026-08-17)
-- Soft-archive seed leftovers; add Resultat mot budget (MONTHLY) like Lager & Logistik.
-- Preserve all kpi_history rows. Do not touch Kyl & Frys or Lager & Logistik.
-- Sick-leave triad (Sjuktimmar / Ordinarie / Sjukfrånvaro) stays active and linked.

do $$
declare
  v_area_id uuid := 'a30b9d4d-d9d7-4975-b7da-413c907e5c3a';
  v_kundstarter uuid := '006ac1c3-7151-4faf-8ef2-c34f1abe482f';
  v_omsattning uuid := '5f2c03dc-8aa2-4a1a-b164-f3709560a472';
  v_resultat uuid;
  v_sick_id uuid;
  v_ordinary_id uuid;
  v_pct_id uuid;
begin
  if not exists (select 1 from public.business_areas where id = v_area_id) then
    select ba.id
    into v_area_id
    from public.business_areas as ba
    where ba.slug = 'fjarr-miljo' or ba.name = 'Fjärr & Miljö'
    limit 1;
  end if;

  if v_area_id is null then
    raise notice 'Fjärr & Miljö not found — skipping KPI decision updates';
    return;
  end if;

  -- Soft-archive requires VD/administrator via trigger; migrations have no auth.uid().
  alter table public.kpis disable trigger kpis_prevent_unauthorized_archive;

  -- 1) Archive Genomförda kundstarter (seed leftover)
  update public.kpis
  set
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
  where id = v_kundstarter
    and business_area_id = v_area_id
    and archived_at is null;

  if not found then
    update public.kpis
    set
      archived_at = coalesce(archived_at, now()),
      updated_at = now()
    where business_area_id = v_area_id
      and name = 'Genomförda kundstarter'
      and archived_at is null;
  end if;

  -- 2) Archive Omsättning mot budget (seed/daily leftover)
  update public.kpis
  set
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
  where id = v_omsattning
    and business_area_id = v_area_id
    and archived_at is null;

  if not found then
    update public.kpis
    set
      archived_at = coalesce(archived_at, now()),
      updated_at = now()
    where business_area_id = v_area_id
      and name = 'Omsättning mot budget'
      and archived_at is null;
  end if;

  alter table public.kpis enable trigger kpis_prevent_unauthorized_archive;

  -- 3) Resultat mot budget — TARGET, MONTHLY (same as Lager & Logistik)
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
      direction = 'HIGHER_IS_BETTER',
      tolerance_type = 'ABSOLUTE',
      yellow_tolerance = coalesce(yellow_tolerance, 0.2),
      category = coalesce(nullif(btrim(category), ''), 'Ekonomi'),
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = 'MONTHLY',
      updated_at = now()
    where id = v_resultat;
  end if;

  -- 4) Keep sick-leave triad exactly (verify links; do not invent new operational KPIs)
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
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'h'),
      category = coalesce(nullif(btrim(category), ''), 'Personal'),
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = coalesce(reporting_frequency, 'DAILY'),
      updated_at = now()
    where id = v_sick_id;
  end if;

  if v_ordinary_id is not null then
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      unit = coalesce(nullif(btrim(unit), ''), 'h'),
      category = coalesce(nullif(btrim(category), ''), 'Personal'),
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      reporting_frequency = coalesce(reporting_frequency, 'DAILY'),
      updated_at = now()
    where id = v_ordinary_id;
  end if;

  if v_pct_id is not null and v_sick_id is not null and v_ordinary_id is not null then
    update public.kpis
    set
      kpi_kind = 'TARGET',
      target_value = coalesce(nullif(btrim(target_value), ''), '3'),
      unit = coalesce(nullif(btrim(unit), ''), '%'),
      category = coalesce(nullif(btrim(category), ''), 'Personal'),
      direction = 'LOWER_IS_BETTER',
      tolerance_type = 'ABSOLUTE',
      yellow_tolerance = coalesce(yellow_tolerance, 1),
      calc_operator = 'RATIO_PERCENT',
      calc_numerator_kpi_id = v_sick_id,
      calc_denominator_kpi_id = v_ordinary_id,
      reporting_frequency = coalesce(reporting_frequency, 'DAILY'),
      status = case
        when status in ('Grön', 'Gul', 'Röd') then status
        else 'Gul'
      end,
      updated_at = now()
    where id = v_pct_id;
  elsif v_pct_id is null or v_sick_id is null or v_ordinary_id is null then
    raise notice
      'Fjärr & Miljö sick-leave triad incomplete (sick=%, ordinary=%, pct=%) — left as-is',
      v_sick_id, v_ordinary_id, v_pct_id;
  end if;
end;
$$;
