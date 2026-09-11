-- Lager & Logistik only: restore the existing productivity TARGET and hours
-- STATISTIC, then remap SUM_DIVIDE from
--   (Kolli OOH + Kolli Byggmax) / Arbetade timmar
-- to
--   Kolli / Arbetade timmar
-- Unarchive only those two existing rows. Keep Kolli OOH and Kolli Byggmax
-- archived. No new KPI rows. No DELETE/UPDATE on kpis history. Other
-- business areas are untouched.

do $$
declare
  v_area_id uuid;
  v_kolli_id uuid;
  v_hours_id uuid;
  v_productivity_id uuid;
  v_denom_id uuid;
  v_ooh_archived_at timestamptz;
  v_byggmax_archived_at timestamptz;
  v_source_names text[];
  v_cutover date := (now() at time zone 'Europe/Stockholm')::date;
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

  select k.id
  into v_kolli_id
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Kolli'
    and k.kpi_kind = 'STATISTIC'
    and k.archived_at is null
  limit 1;

  if v_kolli_id is null then
    raise exception 'Active Lager Kolli STATISTIC not found';
  end if;

  select k.id
  into v_hours_id
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Arbetade timmar'
    and k.kpi_kind = 'STATISTIC'
  order by k.archived_at nulls first, k.created_at
  limit 1;

  if v_hours_id is null then
    raise exception 'Existing Lager Arbetade timmar STATISTIC not found';
  end if;

  select k.id, k.calc_denominator_kpi_id
  into v_productivity_id, v_denom_id
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Kolli per arbetad timme'
    and k.kpi_kind = 'TARGET'
    and k.calc_operator = 'SUM_DIVIDE'
    and k.target_value = '100'
    and k.direction = 'HIGHER_IS_BETTER'
    and k.yellow_tolerance = 10
  order by k.archived_at nulls first, k.created_at
  limit 1;

  if v_productivity_id is null then
    raise exception 'Existing Lager Kolli per arbetad timme TARGET not found';
  end if;

  if v_denom_id is distinct from v_hours_id then
    raise exception 'Lager productivity denominator is not Arbetade timmar';
  end if;

  select k.archived_at
  into v_ooh_archived_at
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Kolli OOH'
  order by k.archived_at desc nulls last, k.created_at
  limit 1;

  select k.archived_at
  into v_byggmax_archived_at
  from public.kpis k
  where k.business_area_id = v_area_id
    and k.name = 'Kolli Byggmax'
  order by k.archived_at desc nulls last, k.created_at
  limit 1;

  if v_ooh_archived_at is null then
    raise exception 'Kolli OOH must remain archived';
  end if;

  if v_byggmax_archived_at is null then
    raise exception 'Kolli Byggmax must remain archived';
  end if;

  -- Migrations run without auth.uid(); bypass only the user-facing archive
  -- guard while this transaction unarchives the two existing KPI rows.
  alter table public.kpis
    disable trigger kpis_prevent_unauthorized_archive;

  foreach v_name in array array[
    'Arbetade timmar',
    'Kolli per arbetad timme'
  ]
  loop
    update public.kpis
    set archived_at = null,
        updated_at = now()
    where business_area_id = v_area_id
      and name = v_name
      and archived_at is not null;
  end loop;

  alter table public.kpis
    enable trigger kpis_prevent_unauthorized_archive;

  select array_agg(k.name order by n.sort_order, n.created_at)
  into v_source_names
  from public.kpi_calc_sum_numerators n
  join public.kpis k on k.id = n.numerator_kpi_id
  where n.parent_kpi_id = v_productivity_id;

  if v_source_names is distinct from array['Kolli']::text[] then
    delete from public.kpi_calc_sum_numerators
    where parent_kpi_id = v_productivity_id;

    insert into public.kpi_calc_sum_numerators (
      parent_kpi_id, numerator_kpi_id, sort_order
    )
    values (v_productivity_id, v_kolli_id, 1);

    -- Freeze history before the first Stockholm date of this remap.
    -- Do not rewrite old kpi_history rows.
    update public.kpis
    set calc_effective_from = v_cutover,
        updated_at = now()
    where id = v_productivity_id
      and calc_effective_from is distinct from v_cutover;
  end if;

  if exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.name in ('Kolli OOH', 'Kolli Byggmax')
      and k.archived_at is null
  ) then
    raise exception 'Kolli OOH or Kolli Byggmax became active';
  end if;
end;
$$;
