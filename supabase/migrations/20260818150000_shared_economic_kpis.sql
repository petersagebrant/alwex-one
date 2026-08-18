-- Shared economic KPI semantics for Kyl, Lager, Fjärr and Mark.
-- Adds explicit result periods and reusable MONTH_TO_DATE_SUM calculations.
-- Existing history is retained; no KPI/history row is deleted.

alter table public.kpi_history
  add column if not exists period_month date null;

comment on column public.kpi_history.period_month is
  'Accounting/result month normalized to its first day. Independent of recorded_at and report_date.';

alter table public.kpi_history
  drop constraint if exists kpi_history_period_month_first_day_check;
alter table public.kpi_history
  add constraint kpi_history_period_month_first_day_check
  check (period_month is null or period_month = date_trunc('month', period_month)::date);

create unique index if not exists kpi_history_kpi_period_month_unique
  on public.kpi_history (kpi_id, period_month)
  where period_month is not null;

create index if not exists kpi_history_period_month_idx
  on public.kpi_history (period_month desc)
  where period_month is not null;

alter table public.kpis
  drop constraint if exists kpis_calc_operator_check;
alter table public.kpis
  add constraint kpis_calc_operator_check
  check (
    calc_operator is null
    or calc_operator in (
      'DIVIDE',
      'SUM_DIVIDE',
      'RATIO_PERCENT',
      'WEIGHTED_RATIO_PERCENT',
      'MONTH_TO_DATE_SUM'
    )
  );

alter table public.kpis
  drop constraint if exists kpis_calc_fields_consistency;
alter table public.kpis
  add constraint kpis_calc_fields_consistency
  check (
    (
      kpi_kind = 'CALCULATED'
      and calc_operator = 'DIVIDE'
      and calc_numerator_kpi_id is not null
      and calc_denominator_kpi_id is not null
      and calc_numerator_kpi_id <> id
      and calc_denominator_kpi_id <> id
      and calc_numerator_kpi_id <> calc_denominator_kpi_id
    )
    or (
      kpi_kind = 'CALCULATED'
      and calc_operator = 'SUM_DIVIDE'
      and calc_numerator_kpi_id is null
      and calc_denominator_kpi_id is not null
      and calc_denominator_kpi_id <> id
    )
    or (
      kpi_kind = 'CALCULATED'
      and calc_operator = 'MONTH_TO_DATE_SUM'
      and calc_numerator_kpi_id is not null
      and calc_numerator_kpi_id <> id
      and calc_denominator_kpi_id is null
    )
    or (
      kpi_kind = 'TARGET'
      and calc_operator = 'RATIO_PERCENT'
      and calc_numerator_kpi_id is not null
      and calc_denominator_kpi_id is not null
      and calc_numerator_kpi_id <> id
      and calc_denominator_kpi_id <> id
      and calc_numerator_kpi_id <> calc_denominator_kpi_id
      and direction is not null
      and target_value is not null
    )
    or (
      kpi_kind = 'TARGET'
      and calc_operator = 'WEIGHTED_RATIO_PERCENT'
      and calc_numerator_kpi_id is null
      and calc_denominator_kpi_id is null
      and direction is not null
      and target_value is not null
    )
    or (
      kpi_kind in ('TARGET', 'STATISTIC')
      and calc_operator is null
      and calc_numerator_kpi_id is null
      and calc_denominator_kpi_id is null
    )
  );

comment on column public.kpis.calc_operator is
  'CALCULATED: DIVIDE, SUM_DIVIDE or MONTH_TO_DATE_SUM. TARGET computed: RATIO_PERCENT or WEIGHTED_RATIO_PERCENT.';

create or replace function public.recalculate_month_to_date_kpis(
  p_input_kpi_id uuid,
  p_changed_date date,
  p_recorded_by uuid default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_calc record;
  v_date date;
  v_sum numeric;
  v_value text;
  v_actor uuid := coalesce(p_recorded_by, auth.uid());
begin
  if p_input_kpi_id is null or p_changed_date is null then
    return;
  end if;

  for v_calc in
    select c.id
    from public.kpis c
    where c.kpi_kind = 'CALCULATED'
      and c.calc_operator = 'MONTH_TO_DATE_SUM'
      and c.calc_numerator_kpi_id = p_input_kpi_id
      and c.archived_at is null
  loop
    for v_date in
      select distinct d.report_date
      from (
        select p_changed_date as report_date
        union all
        select h.report_date
        from public.kpi_history h
        where h.kpi_id = p_input_kpi_id
          and h.report_date >= p_changed_date
          and h.report_date < (date_trunc('month', p_changed_date) + interval '1 month')::date
      ) d
      where d.report_date is not null
      order by d.report_date
    loop
      select sum(public.parse_kpi_numeric_text(h.value))
      into v_sum
      from public.kpi_history h
      where h.kpi_id = p_input_kpi_id
        and h.report_date >= date_trunc('month', v_date)::date
        and h.report_date <= v_date
        and public.parse_kpi_numeric_text(h.value) is not null;

      if v_sum is null then
        continue;
      end if;

      v_value := public.format_kpi_numeric_sv(v_sum);
      perform public.write_computed_kpi_value(
        v_calc.id,
        v_date,
        v_value,
        'Statistik',
        'Beräknad månad hittills',
        v_actor
      );
    end loop;
  end loop;
end;
$$;

comment on function public.recalculate_month_to_date_kpis(uuid, date, uuid) is
  'Recomputes reusable MONTH_TO_DATE_SUM history from the changed date through the affected month.';

create or replace function public.trigger_recalculate_month_to_date_kpis()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.report_date is not null
     and (
       tg_op = 'INSERT'
       or old.value is distinct from new.value
       or old.report_date is distinct from new.report_date
     ) then
    perform public.recalculate_month_to_date_kpis(
      new.kpi_id,
      new.report_date,
      new.recorded_by
    );
  end if;
  return new;
end;
$$;

drop trigger if exists kpi_history_recalculate_month_to_date on public.kpi_history;
create trigger kpi_history_recalculate_month_to_date
  after insert or update of value, report_date on public.kpi_history
  for each row
  execute function public.trigger_recalculate_month_to_date_kpis();

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

comment on function public.upsert_monthly_kpi_report(uuid, date, text, text, text, uuid) is
  'Upserts one finalized monthly TARGET result by accounting period while recorded_at remains the actual submission time.';

-- Backfill existing result history to the normally expected previous month.
-- Conflicts are preserved by leaving older duplicate rows without period_month.
with candidates as (
  select
    h.id,
    (date_trunc('month', h.recorded_at at time zone 'Europe/Stockholm') - interval '1 month')::date as inferred_period,
    row_number() over (
      partition by h.kpi_id,
        (date_trunc('month', h.recorded_at at time zone 'Europe/Stockholm') - interval '1 month')::date
      order by h.recorded_at desc, h.created_at desc, h.id desc
    ) as rn
  from public.kpi_history h
  join public.kpis k on k.id = h.kpi_id
  join public.business_areas ba on ba.id = k.business_area_id
  where k.name = 'Resultat mot budget'
    and (ba.slug in ('kyl-frys', 'lager-logistik', 'fjarr-miljo', 'mark-anlaggning')
      or ba.name in ('Kyl & Frys', 'Lager & Logistik', 'Fjärr & Miljö', 'Mark & Anläggning'))
    and h.period_month is null
)
update public.kpi_history h
set period_month = c.inferred_period
from candidates c
where h.id = c.id
  and c.rn = 1
  and not exists (
    select 1
    from public.kpi_history existing
    where existing.kpi_id = h.kpi_id
      and existing.period_month = c.inferred_period
  );

-- Seed/update the three shared economic KPI definitions for exactly four areas.
do $$
declare
  v_area record;
  v_daily_id uuid;
  v_mtd_id uuid;
  v_result_id uuid;
begin
  for v_area in
    select ba.id, ba.name, ba.slug
    from public.business_areas ba
    where ba.slug in ('kyl-frys', 'lager-logistik', 'fjarr-miljo', 'mark-anlaggning')
       or ba.name in ('Kyl & Frys', 'Lager & Logistik', 'Fjärr & Miljö', 'Mark & Anläggning')
  loop
    v_daily_id := null;
    v_mtd_id := null;
    v_result_id := null;

    -- Reuse Fjärr's active Omsättning KPI and all its history.
    if v_area.slug = 'fjarr-miljo' or v_area.name = 'Fjärr & Miljö' then
      select k.id into v_daily_id
      from public.kpis k
      where k.business_area_id = v_area.id
        and k.name in ('Omsättning idag', 'Omsättning')
        and k.archived_at is null
      order by case when k.name = 'Omsättning idag' then 0 else 1 end, k.created_at
      limit 1;
    else
      select k.id into v_daily_id
      from public.kpis k
      where k.business_area_id = v_area.id
        and k.name = 'Omsättning idag'
        and k.archived_at is null
      limit 1;
    end if;

    if v_daily_id is null then
      insert into public.kpis (
        business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance, reporting_frequency
      )
      values (
        v_area.id, 'Omsättning idag', 'Ekonomi', null, null, 'kr',
        'Statistik', 'Oförändrad', 'STATISTIC', null, null,
        null, null, 'DAILY'
      )
      returning id into v_daily_id;
    else
      update public.kpis
      set name = 'Omsättning idag',
          category = 'Ekonomi',
          unit = 'kr',
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
          reporting_frequency = 'DAILY',
          updated_at = now()
      where id = v_daily_id;
    end if;

    select k.id into v_mtd_id
    from public.kpis k
    where k.business_area_id = v_area.id
      and k.name = 'Omsättning månad hittills'
      and k.archived_at is null
    limit 1;

    if v_mtd_id is null then
      insert into public.kpis (
        business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance, calc_operator,
        calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
      )
      values (
        v_area.id, 'Omsättning månad hittills', 'Ekonomi', null, null, 'kr',
        'Statistik', 'Oförändrad', 'CALCULATED', null, null,
        null, null, 'MONTH_TO_DATE_SUM', v_daily_id, null, 'DAILY'
      )
      returning id into v_mtd_id;
    else
      update public.kpis
      set category = 'Ekonomi',
          unit = 'kr',
          kpi_kind = 'CALCULATED',
          status = 'Statistik',
          target_value = null,
          direction = null,
          tolerance_type = null,
          green_tolerance = null,
          yellow_tolerance = null,
          calc_operator = 'MONTH_TO_DATE_SUM',
          calc_numerator_kpi_id = v_daily_id,
          calc_denominator_kpi_id = null,
          reporting_frequency = 'DAILY',
          updated_at = now()
      where id = v_mtd_id;
    end if;

    select k.id into v_result_id
    from public.kpis k
    where k.business_area_id = v_area.id
      and k.name = 'Resultat mot budget'
      and k.archived_at is null
    order by k.created_at
    limit 1;

    if v_result_id is null then
      insert into public.kpis (
        business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance, reporting_frequency
      )
      values (
        v_area.id, 'Resultat mot budget', 'Ekonomi', '0', null, 'Mkr',
        'Gul', 'Oförändrad', 'TARGET', 'HIGHER_IS_BETTER', 'ABSOLUTE',
        null, 0.2, 'MONTHLY'
      );
    else
      update public.kpis
      set category = 'Ekonomi',
          unit = 'Mkr',
          kpi_kind = 'TARGET',
          target_value = '0',
          direction = 'HIGHER_IS_BETTER',
          tolerance_type = 'ABSOLUTE',
          green_tolerance = null,
          yellow_tolerance = 0.2,
          calc_operator = null,
          calc_numerator_kpi_id = null,
          calc_denominator_kpi_id = null,
          reporting_frequency = 'MONTHLY',
          updated_at = now()
      where id = v_result_id;
    end if;

    -- Populate MTD history from every existing daily revenue point.
    perform public.recalculate_month_to_date_kpis(v_daily_id, h.report_date, null)
    from (
      select min(kh.report_date) as report_date
      from public.kpi_history kh
      where kh.kpi_id = v_daily_id
        and kh.report_date is not null
      group by date_trunc('month', kh.report_date)
    ) h
    where h.report_date is not null;
  end loop;
end;
$$;
