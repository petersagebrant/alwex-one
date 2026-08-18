-- Store both operands for monthly economic reports while retaining `value` as
-- the computed deviation. Existing deviation-only rows remain untouched.

alter table public.kpi_history
  add column if not exists actual_value text null,
  add column if not exists budget_value text null;

comment on column public.kpi_history.actual_value is
  'Optional first operand for a monthly economic result. Null on legacy deviation-only rows.';
comment on column public.kpi_history.budget_value is
  'Optional second operand for a monthly economic result. Null on legacy deviation-only rows.';

alter table public.kpi_history
  drop constraint if exists kpi_history_monthly_economic_pair_check;
alter table public.kpi_history
  add constraint kpi_history_monthly_economic_pair_check
  check (
    (actual_value is null and budget_value is null)
    or (actual_value is not null and budget_value is not null and period_month is not null)
  );

drop function if exists public.upsert_monthly_kpi_report(uuid, date, text, text, text, uuid);

create function public.upsert_monthly_kpi_report(
  p_kpi_id uuid,
  p_period_month date,
  p_actual_value text,
  p_budget_value text,
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
  v_period date;
  v_actor uuid := coalesce(p_recorded_by, auth.uid());
  v_actual numeric;
  v_budget numeric;
  v_deviation numeric;
  v_value text;
  v_status text;
  v_direction text;
  v_tolerance_type text;
  v_yellow numeric;
  v_target numeric;
  v_kind text;
  v_frequency text;
  v_latest_period date;
begin
  if p_kpi_id is null or p_period_month is null then
    raise exception 'kpi_id and period_month are required';
  end if;
  v_period := date_trunc('month', p_period_month)::date;
  if p_period_month <> v_period then
    raise exception 'period_month must be the first day of its month';
  end if;

  v_actual := public.parse_kpi_numeric_text(nullif(btrim(coalesce(p_actual_value, '')), ''));
  v_budget := public.parse_kpi_numeric_text(nullif(btrim(coalesce(p_budget_value, '')), ''));
  if v_actual is null or v_budget is null then
    raise exception 'actual_value and budget_value must both be valid numbers';
  end if;

  select
    k.kpi_kind, k.reporting_frequency, k.direction, k.tolerance_type,
    k.yellow_tolerance, public.parse_kpi_numeric_text(k.target_value)
  into
    v_kind, v_frequency, v_direction, v_tolerance_type,
    v_yellow, v_target
  from public.kpis k
  where k.id = p_kpi_id and k.archived_at is null;

  if not found or v_kind <> 'TARGET' or v_frequency <> 'MONTHLY' then
    raise exception 'Only active monthly TARGET KPIs can use monthly economic reporting';
  end if;
  if v_direction <> 'HIGHER_IS_BETTER' or v_tolerance_type <> 'ABSOLUTE'
     or v_target is null or v_yellow is null then
    raise exception 'Monthly economic KPI requires HIGHER_IS_BETTER with absolute tolerance';
  end if;

  v_deviation := v_actual - v_budget;
  v_value := public.format_kpi_numeric_sv(v_deviation);
  v_status := case
    when v_deviation >= v_target then 'Grön'
    when (v_target - v_deviation) <= v_yellow then 'Gul'
    else 'Röd'
  end;

  insert into public.kpi_history (
    kpi_id, value, actual_value, budget_value, status, comment,
    recorded_at, report_date, period_month, recorded_by
  )
  values (
    p_kpi_id, v_value, public.format_kpi_numeric_sv(v_actual),
    public.format_kpi_numeric_sv(v_budget), v_status,
    nullif(btrim(coalesce(p_comment, '')), ''), now(), null, v_period, v_actor
  )
  on conflict (kpi_id, period_month) where period_month is not null
  do update set
    value = excluded.value,
    actual_value = excluded.actual_value,
    budget_value = excluded.budget_value,
    status = excluded.status,
    comment = excluded.comment,
    recorded_at = now(),
    report_date = null,
    recorded_by = coalesce(excluded.recorded_by, public.kpi_history.recorded_by),
    updated_at = now()
  returning * into v_row;

  select max(h.period_month) into v_latest_period
  from public.kpi_history h
  where h.kpi_id = p_kpi_id
    and h.period_month is not null
    and h.actual_value is not null
    and h.budget_value is not null;

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

comment on function public.upsert_monthly_kpi_report(uuid, date, text, text, text, uuid) is
  'Atomically stores monthly actual, budget and computed deviation; recorded_at is submission time.';
