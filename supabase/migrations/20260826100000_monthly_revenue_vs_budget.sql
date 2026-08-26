-- Replace daily revenue STATISTIC + MTD with monthly TARGET "Omsättning mot budget"
-- on the 7 operational AOs. Soft-archive only; no DELETE from kpis or kpi_history.
-- Alwex totalt is synthetic and deliberately excluded.
-- Fjärr may already have an archived DAILY % row named "Omsättning mot budget".
-- Unique is active rows only, so INSERT of a new active MONTHLY TARGET is OK.
-- Do not un-archive the old % row.

do $$
declare
  v_area record;
  v_result record;
begin
  -- Migrations run without auth.uid(); bypass only the user-facing archive
  -- guard while this transaction soft-archives daily revenue KPIs.
  alter table public.kpis
    disable trigger kpis_prevent_unauthorized_archive;

  for v_area in
    select ba.id, ba.name, ba.slug
    from public.business_areas ba
    where ba.slug <> 'alwex-totalt'
      and lower(btrim(ba.name)) <> 'alwex totalt'
  loop
    update public.kpis
    set archived_at = coalesce(archived_at, now()),
        updated_at = now()
    where business_area_id = v_area.id
      and name in ('Omsättning idag', 'Omsättning månad hittills');

    -- Fjärr leftover: Kr per mil is DIVIDE of archived Omsättning idag / Körda mil.
    update public.kpis k
    set archived_at = coalesce(k.archived_at, now()),
        updated_at = now()
    from public.kpis n
    where k.business_area_id = v_area.id
      and k.name = 'Kr per mil'
      and k.calc_operator = 'DIVIDE'
      and n.id = k.calc_numerator_kpi_id
      and n.name = 'Omsättning idag';

    -- Keep any archived same-name row as-is. Only skip INSERT when an
    -- active MONTHLY TARGET already exists.
    if exists (
      select 1
      from public.kpis k
      where k.business_area_id = v_area.id
        and k.name = 'Omsättning mot budget'
        and k.archived_at is null
    ) then
      continue;
    end if;

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
    into v_result
    from public.kpis k
    where k.business_area_id = v_area.id
      and k.name = 'Resultat mot budget'
      and k.archived_at is null
    order by k.created_at
    limit 1;

    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency
    )
    values (
      v_area.id,
      'Omsättning mot budget',
      coalesce(v_result.category, 'Ekonomi'),
      coalesce(v_result.target_value, '0'),
      null,
      coalesce(v_result.unit, 'Mkr'),
      'Gul',
      'Oförändrad',
      coalesce(v_result.kpi_kind, 'TARGET'),
      coalesce(v_result.direction, 'HIGHER_IS_BETTER'),
      coalesce(v_result.tolerance_type, 'ABSOLUTE'),
      v_result.green_tolerance,
      coalesce(v_result.yellow_tolerance, 0.2),
      coalesce(v_result.reporting_frequency, 'MONTHLY')
    );
  end loop;

  alter table public.kpis
    enable trigger kpis_prevent_unauthorized_archive;
end;
$$;
