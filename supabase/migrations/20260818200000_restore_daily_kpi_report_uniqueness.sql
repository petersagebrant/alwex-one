-- Restore committed daily-report uniqueness and upsert_daily_kpi_report.
-- The earlier Recycling cleanup briefly replaced these with archived_at-aware
-- variants. Operational hiding of testdata uses kpi_history.archived_at only;
-- daily reporting stays on UNIQUE (kpi_id, report_date) as before.

drop index if exists public.kpi_history_kpi_id_report_date_active_uidx;
drop index if exists public.kpi_history_archived_at_idx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kpi_history_kpi_id_report_date_key'
  ) then
    alter table public.kpi_history
      add constraint kpi_history_kpi_id_report_date_key
      unique (kpi_id, report_date);
  end if;
end;
$$;

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
  v_recorded_at timestamptz;
  v_prior_recorded_at timestamptz;
  v_value text;
  v_actor uuid;
  v_existing_id uuid;
  v_old_value text;
  v_old_status text;
  v_prior_date date;
  v_kind text;
  v_calc_operator text;
begin
  if p_kpi_id is null then
    raise exception 'kpi_id is required';
  end if;

  if p_report_date is null then
    raise exception 'report_date is required';
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

  v_recorded_at :=
    ((p_report_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

  select h.id
  into v_existing_id
  from public.kpi_history as h
  where h.kpi_id = p_kpi_id
    and h.report_date = p_report_date
  limit 1;

  if v_existing_id is null then
    select k.current_value, k.status
    into v_old_value, v_old_status
    from public.kpis as k
    where k.id = p_kpi_id
    for update;

    if not found then
      raise exception 'KPI not found: %', p_kpi_id;
    end if;

    v_old_value := btrim(coalesce(v_old_value, ''));
    if v_old_value <> '' then
      v_prior_date := p_report_date - 1;
      v_prior_recorded_at :=
        ((v_prior_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

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
        v_old_value,
        case
          when v_old_status in ('Grön', 'Gul', 'Röd', 'Statistik') then v_old_status
          else 'Gul'
        end,
        'Bevarat före dagsrapport',
        v_prior_recorded_at,
        v_prior_date,
        v_actor
      )
      on conflict (kpi_id, report_date) do nothing;
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
    v_value,
    p_status,
    nullif(btrim(coalesce(p_comment, '')), ''),
    v_recorded_at,
    p_report_date,
    v_actor
  )
  on conflict (kpi_id, report_date)
  do update set
    value = excluded.value,
    status = excluded.status,
    comment = excluded.comment,
    recorded_at = excluded.recorded_at,
    recorded_by = coalesce(excluded.recorded_by, public.kpi_history.recorded_by),
    updated_at = now()
  returning * into v_row;

  update public.kpis
  set
    current_value = v_row.value,
    status = v_row.status,
    updated_at = now()
  where id = p_kpi_id;

  if not found then
    raise exception 'KPI not found: %', p_kpi_id;
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
  'Upsert daily kpi_history, sync kpis, recalculate DIVIDE/RATIO dependents. Rejects CALCULATED and TARGET with calc_operator.';
