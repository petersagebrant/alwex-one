-- Thin batch wrapper: one transaction that loops the existing
-- upsert_daily_kpi_report. Does not duplicate upsert logic and does not
-- delete kpi_history.

create or replace function public.upsert_daily_kpi_reports(
  p_reports jsonb,
  p_recorded_by uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item jsonb;
  v_actor uuid;
begin
  if p_reports is null or jsonb_typeof(p_reports) <> 'array' then
    raise exception 'reports must be a json array';
  end if;

  v_actor := coalesce(p_recorded_by, auth.uid());

  for v_item in
    select value
    from jsonb_array_elements(p_reports)
  loop
    perform public.upsert_daily_kpi_report(
      (v_item->>'kpi_id')::uuid,
      (v_item->>'report_date')::date,
      v_item->>'value',
      v_item->>'status',
      v_item->>'comment',
      v_actor
    );
  end loop;
end;
$$;

comment on function public.upsert_daily_kpi_reports(jsonb, uuid) is
  'Atomic batch of daily KPI reports. Loops upsert_daily_kpi_report in one transaction.';

revoke all on function public.upsert_daily_kpi_reports(jsonb, uuid) from public;
grant execute on function public.upsert_daily_kpi_reports(jsonb, uuid)
  to authenticated;
