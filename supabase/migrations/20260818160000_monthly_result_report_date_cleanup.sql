-- Keep monthly accounting periods separate from daily report dates.
-- Existing rows are retained; only the daily-date marker is cleared.

update public.kpi_history h
set report_date = null
from public.kpis k
where k.id = h.kpi_id
  and k.reporting_frequency = 'MONTHLY'
  and h.period_month is not null
  and h.report_date is not null;

create or replace function public.upsert_monthly_kpi_report(
  p_kpi_id uuid,
  p_period_month date,
  p_value text,
  p_status text,
  p_comment text default null,
  p_recorded_by uuid default null
)
returns public.kpi_history
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.kpi_history;
  v_value text := btrim(coalesce(p_value, ''));
  v_period date;
  v_actor uuid := coalesce(p_recorded_by, auth.uid());
  v_kind text;
  v_frequency text;
  v_latest_period date;
begin
  if p_kpi_id is null then
    raise exception 'kpi_id is required';
  end if;
  if p_period_month is null then
    raise exception 'period_month is required';
  end if;
  v_period := date_trunc('month', p_period_month)::date;
  if p_period_month <> v_period then
    raise exception 'period_month must be the first day of its month';
  end if;
  if v_value = '' then
    raise exception 'value is required';
  end if;
  if p_status not in ('Grön', 'Gul', 'Röd') then
    raise exception 'invalid status';
  end if;

  select k.kpi_kind, k.reporting_frequency
  into v_kind, v_frequency
  from public.kpis k
  where k.id = p_kpi_id
    and k.archived_at is null;

  if not found then
    raise exception 'KPI not found or archived: %', p_kpi_id;
  end if;
  if v_kind <> 'TARGET' or v_frequency <> 'MONTHLY' then
    raise exception 'Only active monthly TARGET KPIs can use monthly reporting';
  end if;

  insert into public.kpi_history (
    kpi_id, value, status, comment, recorded_at, report_date, period_month, recorded_by
  )
  values (
    p_kpi_id,
    v_value,
    p_status,
    nullif(btrim(coalesce(p_comment, '')), ''),
    now(),
    null,
    v_period,
    v_actor
  )
  on conflict (kpi_id, period_month) where period_month is not null
  do update set
    value = excluded.value,
    status = excluded.status,
    comment = excluded.comment,
    recorded_at = now(),
    report_date = null,
    recorded_by = coalesce(excluded.recorded_by, public.kpi_history.recorded_by),
    updated_at = now()
  returning * into v_row;

  select max(h.period_month)
  into v_latest_period
  from public.kpi_history h
  where h.kpi_id = p_kpi_id
    and h.period_month is not null;

  if v_latest_period = v_period then
    update public.kpis
    set current_value = v_row.value, status = v_row.status, updated_at = now()
    where id = p_kpi_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.upsert_monthly_kpi_report(uuid, date, text, text, text, uuid)
  to authenticated;
