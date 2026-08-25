-- Daily report backdating: record when it was saved, keep report_date as the
-- day the value belongs to, never fabricate D−1, and never let an older day
-- overwrite kpis.current_value. Does not rewrite existing kpi_history rows.

create or replace function public.upsert_daily_kpi_report(
  p_kpi_id uuid,
  p_report_date date,
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
  v_value text;
  v_actor uuid;
  v_kind text;
  v_calc_operator text;
  v_max_report_date date;
  v_today date;
begin
  if p_kpi_id is null then
    raise exception 'kpi_id is required';
  end if;

  if p_report_date is null then
    raise exception 'report_date is required';
  end if;

  v_today := (timezone('Europe/Stockholm', now()))::date;
  if p_report_date > v_today then
    raise exception 'report_date cannot be in the future';
  end if;

  v_value := btrim(coalesce(p_value, ''));
  if v_value = '' then
    raise exception 'value is required';
  end if;

  if p_status is null or p_status not in ('Grön', 'Gul', 'Röd', 'Statistik') then
    raise exception 'invalid status';
  end if;

  select k.kpi_kind, k.calc_operator
  into v_kind, v_calc_operator
  from public.kpis as k
  where k.id = p_kpi_id;

  if not found then
    raise exception 'KPI not found: %', p_kpi_id;
  end if;

  if v_kind = 'CALCULATED' or v_calc_operator is not null then
    raise exception 'System-computed KPIs cannot be reported manually';
  end if;

  v_actor := coalesce(p_recorded_by, auth.uid());

  insert into public.kpi_history (
    kpi_id,
    value,
    status,
    comment,
    recorded_at,
    report_date,
    recorded_by
  )
  values (
    p_kpi_id,
    v_value,
    p_status,
    nullif(btrim(coalesce(p_comment, '')), ''),
    now(),
    p_report_date,
    v_actor
  )
  on conflict (kpi_id, report_date)
  do update set
    value = excluded.value,
    status = excluded.status,
    comment = excluded.comment,
    recorded_at = now(),
    recorded_by = coalesce(excluded.recorded_by, public.kpi_history.recorded_by),
    updated_at = now()
  returning * into v_row;

  select max(h.report_date)
  into v_max_report_date
  from public.kpi_history as h
  where h.kpi_id = p_kpi_id
    and h.report_date is not null
    and h.archived_at is null;

  if v_max_report_date is null or p_report_date >= v_max_report_date then
    update public.kpis
    set
      current_value = v_row.value,
      status = v_row.status,
      updated_at = now()
    where id = p_kpi_id;

    if not found then
      raise exception 'KPI not found: %', p_kpi_id;
    end if;
  end if;

  perform public.recalculate_dependent_calculated_kpis(
    p_kpi_id,
    p_report_date,
    v_actor
  );

  return v_row;
end;
$$;

comment on function public.upsert_daily_kpi_report(uuid, date, text, text, text, uuid) is
  'Upsert daily kpi_history for (kpi_id, report_date). recorded_at is submission time. Syncs kpis snapshot only when report_date is the latest active day. Rejects future dates. Recalculates DIVIDE/RATIO dependents.';

create or replace function public.write_computed_kpi_value(
  p_kpi_id uuid,
  p_report_date date,
  p_value text,
  p_status text,
  p_comment text,
  p_recorded_by uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prev_value text;
  v_prev_num numeric;
  v_new_num numeric;
  v_trend text := 'Oförändrad';
  v_max_report_date date;
begin
  if p_kpi_id is null or p_report_date is null or p_value is null or btrim(p_value) = '' then
    return;
  end if;

  select h.value
  into v_prev_value
  from public.kpi_history as h
  where h.kpi_id = p_kpi_id
    and h.report_date is not null
    and h.archived_at is null
    and h.report_date < p_report_date
  order by h.report_date desc
  limit 1;

  v_prev_num := public.parse_kpi_numeric_text(v_prev_value);
  v_new_num := public.parse_kpi_numeric_text(p_value);
  if v_prev_num is not null and v_new_num is not null then
    if v_new_num > v_prev_num then
      v_trend := 'Upp';
    elsif v_new_num < v_prev_num then
      v_trend := 'Ner';
    end if;
  end if;

  insert into public.kpi_history (
    kpi_id,
    value,
    status,
    comment,
    recorded_at,
    report_date,
    recorded_by
  )
  values (
    p_kpi_id,
    p_value,
    p_status,
    nullif(btrim(coalesce(p_comment, '')), ''),
    now(),
    p_report_date,
    p_recorded_by
  )
  on conflict (kpi_id, report_date)
  do update set
    value = excluded.value,
    status = excluded.status,
    comment = excluded.comment,
    recorded_at = now(),
    recorded_by = coalesce(excluded.recorded_by, public.kpi_history.recorded_by),
    updated_at = now();

  select max(h.report_date)
  into v_max_report_date
  from public.kpi_history as h
  where h.kpi_id = p_kpi_id
    and h.report_date is not null
    and h.archived_at is null;

  if v_max_report_date is null or p_report_date >= v_max_report_date then
    update public.kpis
    set
      current_value = p_value,
      status = p_status,
      trend = v_trend,
      updated_at = now()
    where id = p_kpi_id;
  end if;
end;
$$;

comment on function public.write_computed_kpi_value(uuid, date, text, text, text, uuid) is
  'Write computed kpi_history for a report_date. recorded_at is submission time. Syncs kpis snapshot only when report_date is the latest active day.';
