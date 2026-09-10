-- Lager & Logistik only: replace Kolli Byggmax, Kolli OOH, Arbetade timmar
-- and Kolli per arbetad timme with one active STATISTIC KPI named Kolli.
-- Soft-archive the four active rows. No DELETE from kpis or kpi_history.
-- Do not copy or sum old history onto Kolli. Other business areas are untouched.

do $$
declare
  v_area_id uuid;
  v_name text;
begin
  select ba.id
  into v_area_id
  from public.business_areas ba
  where ba.slug = 'lager-logistik'
  limit 1;

  if v_area_id is null then
    raise exception 'Lager & Logistik business area not found';
  end if;

  -- Migrations run without auth.uid(); bypass only the user-facing archive
  -- guard while this transaction soft-archives the four Kolli/hours KPIs.
  alter table public.kpis
    disable trigger kpis_prevent_unauthorized_archive;

  foreach v_name in array array[
    'Kolli Byggmax',
    'Kolli OOH',
    'Arbetade timmar',
    'Kolli per arbetad timme'
  ]
  loop
    update public.kpis
    set archived_at = coalesce(archived_at, now()),
        updated_at = now()
    where business_area_id = v_area_id
      and name = v_name
      and archived_at is null;
  end loop;

  alter table public.kpis
    enable trigger kpis_prevent_unauthorized_archive;

  -- Unique active name is (business_area_id, name) WHERE archived_at IS NULL.
  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.name = 'Kolli'
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
      'Kolli',
      'Volym',
      null,
      null,
      'kolli',
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
