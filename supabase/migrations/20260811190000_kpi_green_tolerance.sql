-- Migration: optional green_tolerance for TARGET_IS_BEST dual bands
-- Existing rows stay NULL → keep tiny green heuristic (no backfill).

alter table public.kpis
  add column if not exists green_tolerance numeric null;

alter table public.kpis
  drop constraint if exists kpis_green_tolerance_nonnegative;

alter table public.kpis
  add constraint kpis_green_tolerance_nonnegative
  check (green_tolerance is null or green_tolerance >= 0);

alter table public.kpis
  drop constraint if exists kpis_green_le_yellow;

alter table public.kpis
  add constraint kpis_green_le_yellow
  check (
    green_tolerance is null
    or yellow_tolerance is null
    or green_tolerance <= yellow_tolerance
  );

comment on column public.kpis.green_tolerance is
  'Optional green band for TARGET_IS_BEST. NULL = tiny heuristic. Same unit as yellow_tolerance.';
