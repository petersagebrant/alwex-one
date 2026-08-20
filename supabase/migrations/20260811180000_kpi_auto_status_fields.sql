-- Migration: KPI automatic status fields
-- Adds optional direction / tolerance so status can be computed.
-- Existing rows stay NULL → manual status (no backfill, no data destruction).

alter table public.kpis
  add column if not exists direction text null,
  add column if not exists tolerance_type text null,
  add column if not exists yellow_tolerance numeric null;

alter table public.kpis
  drop constraint if exists kpis_direction_check;

alter table public.kpis
  add constraint kpis_direction_check
  check (
    direction is null
    or direction in ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET_IS_BEST')
  );

alter table public.kpis
  drop constraint if exists kpis_tolerance_type_check;

alter table public.kpis
  add constraint kpis_tolerance_type_check
  check (
    tolerance_type is null
    or tolerance_type in ('PERCENT', 'ABSOLUTE')
  );

comment on column public.kpis.direction is
  'Optional auto-status direction. NULL = manual status.';

comment on column public.kpis.tolerance_type is
  'Yellow-band unit when direction is set: PERCENT or ABSOLUTE.';

comment on column public.kpis.yellow_tolerance is
  'Yellow band size (percent points if PERCENT, absolute units if ABSOLUTE).';
