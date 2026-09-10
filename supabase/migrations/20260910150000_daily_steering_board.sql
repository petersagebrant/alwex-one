-- Daglig styrning: category on operational_reports + steering fields on activities.
-- No new actions table. Existing Aktiviteter UX is unchanged (nullable/defaulted).

begin;

-- ---------------------------------------------------------------------------
-- operational_reports: simple category for Säkerhet / Drift / Övrigt
-- incident_kind only used when category = sakerhet (not a work-environment system)
-- ---------------------------------------------------------------------------

alter table public.operational_reports
  add column if not exists category text not null default 'ovrigt',
  add column if not exists incident_kind text null;

alter table public.operational_reports
  drop constraint if exists operational_reports_category_check;

alter table public.operational_reports
  add constraint operational_reports_category_check
    check (category in ('sakerhet', 'drift', 'ovrigt'));

alter table public.operational_reports
  drop constraint if exists operational_reports_incident_kind_check;

alter table public.operational_reports
  add constraint operational_reports_incident_kind_check
    check (
      incident_kind is null
      or (
        category = 'sakerhet'
        and incident_kind in ('olycka', 'tillbud', 'allvarlig_risk')
      )
    );

comment on column public.operational_reports.category is
  'sakerhet | drift | ovrigt — public /rapportera classification';

comment on column public.operational_reports.incident_kind is
  'Optional when category = sakerhet: olycka | tillbud | allvarlig_risk';

create index if not exists operational_reports_category_status_idx
  on public.operational_reports (category, status);

-- ---------------------------------------------------------------------------
-- activities: link to a report/KPI and a simple escalation flag.
-- Existing rows stay valid. Admin Aktiviteter does not need these fields.
-- ---------------------------------------------------------------------------

alter table public.activities
  add column if not exists operational_report_id uuid
    references public.operational_reports (id) on delete set null,
  add column if not exists source_kpi_id uuid
    references public.kpis (id) on delete set null,
  add column if not exists requires_escalation boolean not null default false,
  add column if not exists escalated_at timestamptz null;

comment on column public.activities.operational_report_id is
  'Optional link from a steering action back to an operational_report.';

comment on column public.activities.source_kpi_id is
  'Optional link from a steering action back to a KPI.';

comment on column public.activities.requires_escalation is
  'True when the activity needs a decision/escalation. Not a Decision row.';

comment on column public.activities.escalated_at is
  'When requires_escalation was set. Null when not escalated.';

create index if not exists activities_operational_report_id_idx
  on public.activities (operational_report_id)
  where operational_report_id is not null;

create index if not exists activities_source_kpi_id_idx
  on public.activities (source_kpi_id)
  where source_kpi_id is not null;

create index if not exists activities_open_escalation_idx
  on public.activities (requires_escalation, status)
  where requires_escalation = true;

commit;
