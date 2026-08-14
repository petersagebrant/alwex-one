-- Migration: CALCULATED KPIs (DIVIDE via FK columns)
--
-- CALCULATED = derived measure (e.g. Körda mil / Antal RC) with no manual
-- reporting and no Grön/Gul/Röd. Stored status is 'Statistik' (same as STATISTIC).
-- Recalculation runs inside upsert_daily_kpi_report when an input is reported.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.kpis
  add column if not exists calc_operator text null;

alter table public.kpis
  add column if not exists calc_numerator_kpi_id uuid null
    references public.kpis (id) on delete restrict;

alter table public.kpis
  add column if not exists calc_denominator_kpi_id uuid null
    references public.kpis (id) on delete restrict;

comment on column public.kpis.calc_operator is
  'For CALCULATED: operator, currently only DIVIDE.';

comment on column public.kpis.calc_numerator_kpi_id is
  'For CALCULATED DIVIDE: numerator KPI id.';

comment on column public.kpis.calc_denominator_kpi_id is
  'For CALCULATED DIVIDE: denominator KPI id.';

create index if not exists kpis_calc_numerator_kpi_id_idx
  on public.kpis (calc_numerator_kpi_id)
  where calc_numerator_kpi_id is not null;

create index if not exists kpis_calc_denominator_kpi_id_idx
  on public.kpis (calc_denominator_kpi_id)
  where calc_denominator_kpi_id is not null;

-- ---------------------------------------------------------------------------
-- Kind + consistency checks
-- ---------------------------------------------------------------------------

alter table public.kpis
  drop constraint if exists kpis_kpi_kind_check;

alter table public.kpis
  add constraint kpis_kpi_kind_check
    check (kpi_kind in ('TARGET', 'STATISTIC', 'CALCULATED'));

comment on column public.kpis.kpi_kind is
  'TARGET = goal KPI with Grön/Gul/Röd. STATISTIC = manual measure without target/status. CALCULATED = derived from other KPIs (no manual report).';

alter table public.kpis
  drop constraint if exists kpis_kind_status_consistency;

alter table public.kpis
  add constraint kpis_kind_status_consistency
    check (
      (kpi_kind = 'TARGET' and status in ('Grön', 'Gul', 'Röd'))
      or (kpi_kind = 'STATISTIC' and status = 'Statistik')
      or (kpi_kind = 'CALCULATED' and status = 'Statistik')
    );

alter table public.kpis
  drop constraint if exists kpis_calc_operator_check;

alter table public.kpis
  add constraint kpis_calc_operator_check
    check (
      calc_operator is null
      or calc_operator = 'DIVIDE'
    );

alter table public.kpis
  drop constraint if exists kpis_calc_fields_consistency;

alter table public.kpis
  add constraint kpis_calc_fields_consistency
    check (
      (
        kpi_kind = 'CALCULATED'
        and calc_operator is not null
        and calc_numerator_kpi_id is not null
        and calc_denominator_kpi_id is not null
        and calc_numerator_kpi_id <> id
        and calc_denominator_kpi_id <> id
        and calc_numerator_kpi_id <> calc_denominator_kpi_id
      )
      or (
        kpi_kind <> 'CALCULATED'
        and calc_operator is null
        and calc_numerator_kpi_id is null
        and calc_denominator_kpi_id is null
      )
    );

-- ---------------------------------------------------------------------------
-- Format helper: Swedish decimal comma, trim trailing zeros
-- ---------------------------------------------------------------------------

create or replace function public.format_kpi_numeric_sv(p_value numeric)
returns text
language plpgsql
immutable
as $$
declare
  v_text text;
begin
  if p_value is null then
    return null;
  end if;

  v_text := trim(to_char(round(p_value, 3), 'FM999999999999990.999'));
  v_text := rtrim(rtrim(v_text, '0'), '.');
  if v_text = '' or v_text = '-' then
    v_text := '0';
  end if;
  return replace(v_text, '.', ',');
end;
$$;

-- ---------------------------------------------------------------------------
-- Recalculate CALCULATED KPIs that depend on an input for a report_date
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_dependent_calculated_kpis(
  p_input_kpi_id uuid,
  p_report_date date,
  p_recorded_by uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_calc record;
  v_num_text text;
  v_den_text text;
  v_num numeric;
  v_den numeric;
  v_result numeric;
  v_value text;
  v_actor uuid;
  v_recorded_at timestamptz;
begin
  if p_input_kpi_id is null or p_report_date is null then
    return;
  end if;

  v_actor := coalesce(p_recorded_by, auth.uid());
  v_recorded_at :=
    ((p_report_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

  for v_calc in
    select
      c.id,
      c.calc_operator,
      c.calc_numerator_kpi_id,
      c.calc_denominator_kpi_id
    from public.kpis as c
    where c.kpi_kind = 'CALCULATED'
      and c.archived_at is null
      and (
        c.calc_numerator_kpi_id = p_input_kpi_id
        or c.calc_denominator_kpi_id = p_input_kpi_id
      )
  loop
    if v_calc.calc_operator is distinct from 'DIVIDE' then
      continue;
    end if;

    select h.value
    into v_num_text
    from public.kpi_history as h
    where h.kpi_id = v_calc.calc_numerator_kpi_id
      and h.report_date = p_report_date
    limit 1;

    select h.value
    into v_den_text
    from public.kpi_history as h
    where h.kpi_id = v_calc.calc_denominator_kpi_id
      and h.report_date = p_report_date
    limit 1;

    if v_num_text is null or btrim(v_num_text) = '' then
      continue;
    end if;
    if v_den_text is null or btrim(v_den_text) = '' then
      continue;
    end if;

    begin
      v_num := replace(replace(btrim(v_num_text), ' ', ''), ',', '.')::numeric;
      v_den := replace(replace(btrim(v_den_text), ' ', ''), ',', '.')::numeric;
    exception
      when others then
        continue;
    end;

    if v_den = 0 then
      continue;
    end if;

    v_result := v_num / v_den;
    v_value := public.format_kpi_numeric_sv(v_result);
    if v_value is null or v_value = '' then
      continue;
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
      v_calc.id,
      v_value,
      'Statistik',
      'Beräknad',
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
      updated_at = now();

    update public.kpis
    set
      current_value = v_value,
      status = 'Statistik',
      updated_at = now()
    where id = v_calc.id;
  end loop;
end;
$$;

comment on function public.recalculate_dependent_calculated_kpis(uuid, date, uuid) is
  'After an input KPI daily report: recompute CALCULATED dependents for that report_date. Skips missing/zero denominator.';

-- ---------------------------------------------------------------------------
-- Daily report RPC: after upsert, recalculate dependents
-- ---------------------------------------------------------------------------

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

  select k.kpi_kind
  into v_kind
  from public.kpis as k
  where k.id = p_kpi_id;

  if not found then
    raise exception 'KPI not found: %', p_kpi_id;
  end if;

  if v_kind = 'CALCULATED' then
    raise exception 'CALCULATED KPIs cannot be reported manually';
  end if;

  v_actor := coalesce(p_recorded_by, auth.uid());

  -- Stable midday timestamp in Europe/Stockholm for the report calendar day
  v_recorded_at :=
    ((p_report_date::timestamp + time '12:00') at time zone 'Europe/Stockholm');

  select h.id
  into v_existing_id
  from public.kpi_history as h
  where h.kpi_id = p_kpi_id
    and h.report_date = p_report_date
  limit 1;

  if v_existing_id is null then
    -- First report today: lock KPI and preserve current snapshot as prior day if free.
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
  'Upsert one daily kpi_history row for (kpi_id, report_date), preserve prior current_value on first report of the day when prior day is free, sync kpis.current_value/status, then recalculate CALCULATED dependents. Status may be Grön/Gul/Röd/Statistik. Rejects CALCULATED KPIs.';

-- ---------------------------------------------------------------------------
-- Seed: Antal RC (ensure), Körda mil, Körda mil per RC for Kyl & Frys
-- ---------------------------------------------------------------------------

do $$
declare
  v_area_id uuid;
  v_antal_rc_id uuid;
  v_korda_mil_id uuid;
  v_per_rc_id uuid;
begin
  select ba.id
  into v_area_id
  from public.business_areas as ba
  where ba.name = 'Kyl & Frys'
  limit 1;

  if v_area_id is null then
    raise notice 'Kyl & Frys not found — skipping calculated KPI seed';
    return;
  end if;

  -- Antal RC (STATISTIC) — create if missing
  select k.id
  into v_antal_rc_id
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Antal RC'
    and k.archived_at is null
  limit 1;

  if v_antal_rc_id is null then
    insert into public.kpis (
      business_area_id,
      name,
      category,
      target_value,
      current_value,
      unit,
      status,
      trend,
      kpi_kind,
      direction,
      tolerance_type,
      green_tolerance,
      yellow_tolerance
    )
    values (
      v_area_id,
      'Antal RC',
      'Volym',
      null,
      null,
      'st',
      'Statistik',
      'Oförändrad',
      'STATISTIC',
      null,
      null,
      null,
      null
    )
    returning id into v_antal_rc_id;
  else
    update public.kpis
    set
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      updated_at = now()
    where id = v_antal_rc_id
      and (
        kpi_kind is distinct from 'STATISTIC'
        or status is distinct from 'Statistik'
      );
  end if;

  -- Körda mil (STATISTIC)
  select k.id
  into v_korda_mil_id
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Körda mil'
    and k.archived_at is null
  limit 1;

  if v_korda_mil_id is null then
    insert into public.kpis (
      business_area_id,
      name,
      category,
      target_value,
      current_value,
      unit,
      status,
      trend,
      kpi_kind,
      direction,
      tolerance_type,
      green_tolerance,
      yellow_tolerance
    )
    values (
      v_area_id,
      'Körda mil',
      'Effektivitet',
      null,
      null,
      'mil',
      'Statistik',
      'Oförändrad',
      'STATISTIC',
      null,
      null,
      null,
      null
    )
    returning id into v_korda_mil_id;
  else
    update public.kpis
    set
      category = coalesce(nullif(btrim(category), ''), 'Effektivitet'),
      unit = coalesce(nullif(btrim(unit), ''), 'mil'),
      kpi_kind = 'STATISTIC',
      status = 'Statistik',
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      calc_operator = null,
      calc_numerator_kpi_id = null,
      calc_denominator_kpi_id = null,
      updated_at = now()
    where id = v_korda_mil_id;
  end if;

  -- Körda mil per RC (CALCULATED = Körda mil / Antal RC)
  select k.id
  into v_per_rc_id
  from public.kpis as k
  where k.business_area_id = v_area_id
    and k.name = 'Körda mil per RC'
    and k.archived_at is null
  limit 1;

  if v_per_rc_id is null then
    insert into public.kpis (
      business_area_id,
      name,
      category,
      target_value,
      current_value,
      unit,
      status,
      trend,
      kpi_kind,
      direction,
      tolerance_type,
      green_tolerance,
      yellow_tolerance,
      calc_operator,
      calc_numerator_kpi_id,
      calc_denominator_kpi_id
    )
    values (
      v_area_id,
      'Körda mil per RC',
      'Effektivitet',
      null,
      null,
      'mil/RC',
      'Statistik',
      'Oförändrad',
      'CALCULATED',
      null,
      null,
      null,
      null,
      'DIVIDE',
      v_korda_mil_id,
      v_antal_rc_id
    );
  else
    update public.kpis
    set
      category = coalesce(nullif(btrim(category), ''), 'Effektivitet'),
      unit = coalesce(nullif(btrim(unit), ''), 'mil/RC'),
      kpi_kind = 'CALCULATED',
      status = 'Statistik',
      target_value = null,
      direction = null,
      tolerance_type = null,
      green_tolerance = null,
      yellow_tolerance = null,
      calc_operator = 'DIVIDE',
      calc_numerator_kpi_id = v_korda_mil_id,
      calc_denominator_kpi_id = v_antal_rc_id,
      updated_at = now()
    where id = v_per_rc_id;
  end if;
end;
$$;
