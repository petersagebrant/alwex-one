-- Fröträdet: archive Leveransförmåga (keep history) and add two MONTHLY
-- STATISTIC KPIs. Introduce generic monthly statistic reporting that writes
-- kpi_history.period_month. Does not alter daily reporting, economic TARGET
-- monthly reporting, or month-to-date recalculation.

do $$
declare
  v_area_id uuid;
  v_leverans_id uuid := '880f6f17-305a-4c05-bbbd-e45756f4317d';
  v_energy_id uuid := 'b77f2264-d2db-4ed0-a6f0-34c514b24e99';
  v_offices_id uuid := '97823e81-7a87-4dfc-b664-16d14d90dd79';
begin
  select ba.id
  into v_area_id
  from public.business_areas ba
  where ba.slug = 'frotradet'
  limit 1;

  if v_area_id is null then
    raise exception 'Fröträdet business area not found';
  end if;

  -- Migrations run without auth.uid(); bypass only the user-facing archive
  -- guard while this transaction soft-archives Leveransförmåga.
  alter table public.kpis
    disable trigger kpis_prevent_unauthorized_archive;

  update public.kpis
  set archived_at = coalesce(archived_at, now()),
      updated_at = now()
  where business_area_id = v_area_id
    and (
      id = v_leverans_id
      or name = 'Leveransförmåga'
    );

  alter table public.kpis
    enable trigger kpis_prevent_unauthorized_archive;

  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_energy_id or k.name = 'Energiförbrukning per månad')
  ) then
    insert into public.kpis (
      id, business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_energy_id, v_area_id, 'Energiförbrukning per månad', 'Energi',
      null, null, 'kWh',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, null, null, null, 'MONTHLY'
    );
  else
    select k.id
    into v_energy_id
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (k.id = v_energy_id or k.name = 'Energiförbrukning per månad')
    order by case when k.id = v_energy_id then 0 else 1 end
    limit 1;

    update public.kpis
    set category = 'Energi',
        unit = 'kWh',
        status = 'Statistik',
        trend = 'Oförändrad',
        kpi_kind = 'STATISTIC',
        target_value = null,
        current_value = current_value,
        direction = null,
        tolerance_type = null,
        green_tolerance = null,
        yellow_tolerance = null,
        calc_operator = null,
        calc_numerator_kpi_id = null,
        calc_denominator_kpi_id = null,
        reporting_frequency = 'MONTHLY',
        updated_at = now()
    where id = v_energy_id;
  end if;

  if not exists (
    select 1
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (
        k.id = v_offices_id
        or k.name = 'Antal uthyrda kontor per månad'
      )
  ) then
    insert into public.kpis (
      id, business_area_id, name, category, target_value, current_value, unit,
      status, trend, kpi_kind, direction, tolerance_type,
      green_tolerance, yellow_tolerance, calc_operator,
      calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
    )
    values (
      v_offices_id, v_area_id, 'Antal uthyrda kontor per månad', 'Fastighet',
      null, null, 'st',
      'Statistik', 'Oförändrad', 'STATISTIC', null, null,
      null, null, null, null, null, 'MONTHLY'
    );
  else
    select k.id
    into v_offices_id
    from public.kpis k
    where k.business_area_id = v_area_id
      and k.archived_at is null
      and (
        k.id = v_offices_id
        or k.name = 'Antal uthyrda kontor per månad'
      )
    order by case when k.id = v_offices_id then 0 else 1 end
    limit 1;

    update public.kpis
    set category = 'Fastighet',
        unit = 'st',
        status = 'Statistik',
        trend = 'Oförändrad',
        kpi_kind = 'STATISTIC',
        target_value = null,
        current_value = current_value,
        direction = null,
        tolerance_type = null,
        green_tolerance = null,
        yellow_tolerance = null,
        calc_operator = null,
        calc_numerator_kpi_id = null,
        calc_denominator_kpi_id = null,
        reporting_frequency = 'MONTHLY',
        updated_at = now()
    where id = v_offices_id;
  end if;
end;
$$;

create or replace function public.upsert_monthly_statistic_report(
  p_kpi_id uuid,
  p_period_month date,
  p_value text,
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
  v_numeric numeric;
  v_value text;
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

  v_numeric := public.parse_kpi_numeric_text(nullif(btrim(coalesce(p_value, '')), ''));
  if v_numeric is null then
    raise exception 'value must be a valid number';
  end if;
  v_value := public.format_kpi_numeric_sv(v_numeric);

  select k.kpi_kind, k.reporting_frequency
  into v_kind, v_frequency
  from public.kpis k
  where k.id = p_kpi_id and k.archived_at is null;

  if not found or v_kind <> 'STATISTIC' or v_frequency <> 'MONTHLY' then
    raise exception 'Only active monthly STATISTIC KPIs can use monthly statistic reporting';
  end if;

  insert into public.kpi_history (
    kpi_id, value, actual_value, budget_value, status, comment,
    recorded_at, report_date, period_month, recorded_by
  )
  values (
    p_kpi_id, v_value, null, null, 'Statistik',
    nullif(btrim(coalesce(p_comment, '')), ''), now(), null, v_period, v_actor
  )
  on conflict (kpi_id, period_month) where period_month is not null
  do update set
    value = excluded.value,
    actual_value = null,
    budget_value = null,
    status = 'Statistik',
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
    and h.archived_at is null;

  if v_latest_period = v_period then
    update public.kpis
    set current_value = v_row.value, status = 'Statistik', updated_at = now()
    where id = p_kpi_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.upsert_monthly_statistic_report(uuid, date, text, text, uuid)
  to authenticated;

comment on function public.upsert_monthly_statistic_report(uuid, date, text, text, uuid) is
  'Stores a monthly STATISTIC value against period_month; recorded_at is submission time.';
