-- Configurable daily presentation for RATIO_PERCENT inputs.
-- Existing ratios stay grouped by default; Mark & Anläggning reports each input separately.

alter table public.kpis
  add column if not exists ratio_reporting_mode text not null default 'GROUPED';

alter table public.kpis
  drop constraint if exists kpis_ratio_reporting_mode_check;

alter table public.kpis
  add constraint kpis_ratio_reporting_mode_check
    check (ratio_reporting_mode in ('GROUPED', 'SEPARATE_INPUTS'));

comment on column public.kpis.ratio_reporting_mode is
  'RATIO_PERCENT daily UI/progress: GROUPED is one composite point; SEPARATE_INPUTS counts and displays each manual input separately.';

do $$
declare
  v_area_id uuid;
  v_sick_ratio_id uuid;
  v_numerator_id uuid;
  v_denominator_id uuid;
begin
  select ba.id
  into v_area_id
  from public.business_areas as ba
  where ba.slug = 'mark-anlaggning' or ba.name = 'Mark & Anläggning'
  order by (ba.slug = 'mark-anlaggning') desc
  limit 1;

  if v_area_id is null then
    raise notice 'Mark & Anläggning not found — skipping ratio reporting mode update';
    return;
  end if;

  select k.id, k.calc_numerator_kpi_id, k.calc_denominator_kpi_id
  into v_sick_ratio_id, v_numerator_id, v_denominator_id
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Sjukfrånvaro'
    and k.kpi_kind = 'TARGET'
    and k.calc_operator = 'RATIO_PERCENT'
    and k.archived_at is null
  limit 1;

  if v_sick_ratio_id is null then
    raise notice 'Active Mark & Anläggning Sjukfrånvaro ratio not found — skipping';
    return;
  end if;

  -- Keep the result read-only/system-computed with the agreed target and G/Y/R model.
  update public.kpis
  set
    target_value = '3',
    unit = '%',
    direction = 'LOWER_IS_BETTER',
    tolerance_type = 'ABSOLUTE',
    green_tolerance = null,
    yellow_tolerance = 1,
    reporting_frequency = 'DAILY',
    ratio_reporting_mode = 'SEPARATE_INPUTS',
    updated_at = now()
  where id = v_sick_ratio_id;

  -- Both linked manual inputs are independent DAILY reporting points.
  update public.kpis
  set
    reporting_frequency = 'DAILY',
    updated_at = now()
  where id in (v_numerator_id, v_denominator_id)
    and kpi_kind = 'STATISTIC'
    and reporting_frequency is distinct from 'DAILY';
end;
$$;
