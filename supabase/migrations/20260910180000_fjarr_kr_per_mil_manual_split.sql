-- Fjärr & Miljö only: replace Körda mil with two manual STATISTIC KPIs
-- named Kr per mil – Elit and Kr per mil – Fjärr (en-dash). Soft-archive
-- only Körda mil. Do not touch archived Kr per mil (no unarchive, rename,
-- or history copy). No DELETE from kpis or kpi_history. Other business
-- areas are untouched.

do $$
declare
  v_area_id uuid;
  v_name text;
begin
  select ba.id
  into v_area_id
  from public.business_areas ba
  where ba.slug = 'fjarr-miljo'
  limit 1;

  if v_area_id is null then
    raise exception 'Fjärr & Miljö business area not found';
  end if;

  -- Migrations run without auth.uid(); bypass only the user-facing archive
  -- guard while this transaction soft-archives Körda mil.
  alter table public.kpis
    disable trigger kpis_prevent_unauthorized_archive;

  update public.kpis
  set archived_at = coalesce(archived_at, now()),
      updated_at = now()
  where business_area_id = v_area_id
    and name = 'Körda mil'
    and archived_at is null;

  alter table public.kpis
    enable trigger kpis_prevent_unauthorized_archive;

  -- Unique active name is (business_area_id, name) WHERE archived_at IS NULL.
  -- Do not unarchive or rename the archived CALCULATED Kr per mil row.
  foreach v_name in array array[
    'Kr per mil – Elit',
    'Kr per mil – Fjärr'
  ]
  loop
    if not exists (
      select 1
      from public.kpis k
      where k.business_area_id = v_area_id
        and k.name = v_name
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
        v_name,
        'Ekonomi',
        null,
        null,
        'kr/mil',
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
  end loop;
end;
$$;
