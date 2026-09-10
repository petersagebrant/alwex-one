-- Intermodal only: enable auto-status on the two existing operational
-- TARGET KPIs. Update in place. Do not INSERT duplicates. Do not DELETE.
-- Preserve current_value and kpi_history. Keep existing target_value.
-- Sjukfrånvaro, Övertid, and monthly economics are unchanged.
--
-- Bands (HIGHER_IS_BETTER + ABSOLUTE yellow_tolerance, existing engine):
--   Leveransprecision: target 98.5, yellow 1.5 → green >= 98.5, yellow >= 97.0, red < 97.0
--   Beläggning tågpendlar: target 85, yellow 5 → green >= 85, yellow >= 80, red < 80

do $$
declare
  v_area_id uuid;
  v_updated int;
begin
  select ba.id
  into v_area_id
  from public.business_areas ba
  where ba.slug = 'intermodal'
  limit 1;

  if v_area_id is null then
    raise exception 'Intermodal business area not found';
  end if;

  -- 1) Leveransprecision — keep target_value (seed 98,5), yellow 1.5 pp
  update public.kpis
  set
    kpi_kind = 'TARGET',
    unit = coalesce(nullif(btrim(unit), ''), '%'),
    direction = 'HIGHER_IS_BETTER',
    tolerance_type = 'ABSOLUTE',
    yellow_tolerance = 1.5,
    status = coalesce(
      public.compute_kpi_status_sql(
        'HIGHER_IS_BETTER',
        'ABSOLUTE',
        null,
        1.5,
        public.parse_kpi_numeric_text(current_value),
        public.parse_kpi_numeric_text(target_value)
      ),
      status
    ),
    updated_at = now()
  where business_area_id = v_area_id
    and name = 'Leveransprecision'
    and archived_at is null;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Expected one active Intermodal Leveransprecision, found %', v_updated;
  end if;

  -- 2) Beläggning tågpendlar — keep target_value (seed 85), yellow 5 pp
  update public.kpis
  set
    kpi_kind = 'TARGET',
    unit = coalesce(nullif(btrim(unit), ''), '%'),
    direction = 'HIGHER_IS_BETTER',
    tolerance_type = 'ABSOLUTE',
    yellow_tolerance = 5,
    status = coalesce(
      public.compute_kpi_status_sql(
        'HIGHER_IS_BETTER',
        'ABSOLUTE',
        null,
        5,
        public.parse_kpi_numeric_text(current_value),
        public.parse_kpi_numeric_text(target_value)
      ),
      status
    ),
    updated_at = now()
  where business_area_id = v_area_id
    and name = 'Beläggning tågpendlar'
    and archived_at is null;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Expected one active Intermodal Beläggning tågpendlar, found %', v_updated;
  end if;
end;
$$;
