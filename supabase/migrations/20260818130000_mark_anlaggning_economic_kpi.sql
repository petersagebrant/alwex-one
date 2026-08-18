-- Mark & Anläggning economic KPI decision (2026-08-18)
-- Soft-archive Budgetavvikelse and keep Projekt i tid archived.
-- Add Resultat mot budget (MONTHLY) using the Lager & Logistik model.
-- Preserve KPI history and do not touch any other business area.

do $$
declare
  v_area_id uuid := '550a4dc4-97a6-48fb-99b8-ef2e4c16b5a7';
  v_resultat_id uuid;
begin
  if not exists (select 1 from public.business_areas where id = v_area_id) then
    select ba.id
    into v_area_id
    from public.business_areas as ba
    where ba.slug = 'mark-anlaggning' or ba.name = 'Mark & Anläggning'
    limit 1;
  end if;

  if v_area_id is null then
    raise notice 'Mark & Anläggning not found — skipping economic KPI update';
    return;
  end if;

  -- Migrations run without auth.uid(); temporarily bypass the user-facing archive guard.
  alter table public.kpis disable trigger kpis_prevent_unauthorized_archive;

  update public.kpis
  set
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
  where business_area_id = v_area_id
    and name in ('Budgetavvikelse', 'Projekt i tid')
    and archived_at is null;

  alter table public.kpis enable trigger kpis_prevent_unauthorized_archive;

  -- TARGET, manual, 0 Mkr, HIGHER_IS_BETTER, ABSOLUTE yellow tolerance 0.2.
  -- MONTHLY keeps it in the monthly section and outside daily progress.
  select k.id
  into v_resultat_id
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Resultat mot budget'
    and k.archived_at is null
  limit 1;

  if v_resultat_id is null then
    insert into public.kpis (
      business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, reporting_frequency,
      calc_operator, calc_numerator_kpi_id, calc_denominator_kpi_id
    )
    values (
      v_area_id, 'Resultat mot budget', 'Ekonomi', '0', null, 'Mkr',
      'Gul', 'Oförändrad', 'TARGET', 'HIGHER_IS_BETTER', 'ABSOLUTE',
      null, 0.2, 'MONTHLY',
      null, null, null
    );
  else
    update public.kpis
    set
      category = 'Ekonomi',
      target_value = '0',
      unit = 'Mkr',
      kpi_kind = 'TARGET',
      direction = 'HIGHER_IS_BETTER',
      tolerance_type = 'ABSOLUTE',
      green_tolerance = null,
      yellow_tolerance = 0.2,
      reporting_frequency = 'MONTHLY',
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      updated_at = now()
    where id = v_resultat_id;
  end if;
end;
$$;
