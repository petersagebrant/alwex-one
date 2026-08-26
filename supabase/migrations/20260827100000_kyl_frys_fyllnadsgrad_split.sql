-- Kyl & Frys only: split Fyllnadsgrad into two daily TARGET KPIs and add
-- Intjänandegrad per RPU. Soft-archive the active row named exactly
-- Fyllnadsgrad. No DELETE from kpis or kpi_history. Do not copy history
-- onto the new KPIs. Other business areas are untouched.
--
-- Intjänandegrad per RPU is STATISTIC DAILY, not TARGET with a null mål.
-- TARGET with target_value null cannot compute G/Y/R (computeKpiStatus
-- returns null); the daily form then falls back to Gul and requires a
-- deviation comment. Historik och målvärde kan användas senare: admin can
-- set a target and convert to TARGET (HIGHER_IS_BETTER). Do not invent 0 or 90.

do $$
declare
  v_area_id uuid;
  v_src record;
  v_name text;
begin
  select ba.id
  into v_area_id
  from public.business_areas ba
  where ba.slug = 'kyl-frys'
  limit 1;

  if v_area_id is null then
    raise exception 'Kyl & Frys business area not found';
  end if;

  -- Migrations run without auth.uid(); bypass only the user-facing archive
  -- guard while this transaction soft-archives Fyllnadsgrad.
  alter table public.kpis
    disable trigger kpis_prevent_unauthorized_archive;

  update public.kpis
  set archived_at = coalesce(archived_at, now()),
      updated_at = now()
  where business_area_id = v_area_id
    and name = 'Fyllnadsgrad';

  alter table public.kpis
    enable trigger kpis_prevent_unauthorized_archive;

  select
    k.category,
    k.target_value,
    k.unit,
    k.kpi_kind,
    k.direction,
    k.tolerance_type,
    k.green_tolerance,
    k.yellow_tolerance,
    k.reporting_frequency
  into v_src
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Fyllnadsgrad'
  order by k.archived_at desc nulls last, k.created_at
  limit 1;

  foreach v_name in array array[
    'Fyllnadsgrad mellantransporter',
    'Fyllnadsgrad distributionstransporter'
  ]
  loop
    if exists (
      select 1
      from public.kpis k
      where k.business_area_id = v_area_id
        and k.name = v_name
        and k.archived_at is null
    ) then
      continue;
    end if;

    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_area_id,
      v_name,
      coalesce(v_src.category, 'Effektivitet'),
      coalesce(v_src.target_value, '90'),
      null,
      coalesce(v_src.unit, '%'),
      'Gul',
      'Oförändrad',
      coalesce(v_src.kpi_kind, 'TARGET'),
      coalesce(v_src.direction, 'HIGHER_IS_BETTER'),
      coalesce(v_src.tolerance_type, 'ABSOLUTE'),
      coalesce(v_src.green_tolerance, 0),
      coalesce(v_src.yellow_tolerance, 5),
      null,
      null,
      null,
      coalesce(v_src.reporting_frequency, 'DAILY')
    );
  end loop;

  -- STATISTIC DAILY until a real målvärde exists. Convert to TARGET later
  -- via admin (HIGHER_IS_BETTER, unit kr/RPU, category Effektivitet).
  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.name = 'Intjänandegrad per RPU'
      and k.archived_at is null
  ) then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_area_id,
      'Intjänandegrad per RPU',
      'Effektivitet',
      null,
      null,
      'kr/RPU',
      'Statistik',
      'Oförändrad',
      'STATISTIC',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'DAILY'
    );
  end if;
end;
$$;
