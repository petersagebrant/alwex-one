-- Complete the archived-history MTD correction.
-- If every source row through a report date is archived, write an active sum
-- of zero instead of leaving the previous calculated value in place.

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
          and h.report_date < (
            date_trunc('month', p_changed_date) + interval '1 month'
          )::date
      ) d
      where d.report_date is not null
      order by d.report_date
    loop
      select coalesce(
        sum(public.parse_kpi_numeric_text(h.value)),
        0
      )
      into v_sum
      from public.kpi_history h
      where h.kpi_id = p_input_kpi_id
        and h.report_date >= date_trunc('month', v_date)::date
        and h.report_date <= v_date
        and h.archived_at is null
        and public.parse_kpi_numeric_text(h.value) is not null;

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
  'Recomputes MONTH_TO_DATE_SUM from active source rows; an empty active sum is zero.';
