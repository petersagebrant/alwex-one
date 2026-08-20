-- Migration: soft-archive KPIs (preserve history)
--
-- archived_at NULL = active (shown in reporting/dashboard/AI).
-- archived_at set = archived (hidden from operational views; kept for admin + history).

alter table public.kpis
  add column if not exists archived_at timestamptz null;

comment on column public.kpis.archived_at is
  'When set, KPI is archived: excluded from reporting/dashboard/AI. History rows are kept.';

create index if not exists kpis_archived_at_idx
  on public.kpis (archived_at);

-- Allow same name again after archive (only one active name per area).
drop index if exists kpis_business_area_id_name_uidx;

create unique index if not exists kpis_business_area_id_name_active_uidx
  on public.kpis (business_area_id, name)
  where archived_at is null;

-- Only VD / administrator may change archived_at (AO-chef may still update other fields).
create or replace function public.prevent_unauthorized_kpi_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.archived_at is distinct from old.archived_at then
    if not public.has_app_role(array['vd', 'administrator']::public.app_role[]) then
      raise exception 'Endast VD eller administratör kan arkivera eller återaktivera KPI.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists kpis_prevent_unauthorized_archive on public.kpis;

create trigger kpis_prevent_unauthorized_archive
  before update on public.kpis
  for each row
  execute function public.prevent_unauthorized_kpi_archive();
