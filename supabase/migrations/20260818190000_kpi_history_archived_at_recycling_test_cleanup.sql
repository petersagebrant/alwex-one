-- Recycling testdata cleanup only.
-- Hide the confirmed Volymutveckling 50% test report from operational views.
-- Soft-archive that one history row (no DELETE). Reset the KPI snapshot
-- from remaining history. Does not change daily upsert, uniqueness,
-- economics, KPI definitions, or other business areas.

alter table public.kpi_history
  add column if not exists archived_at timestamptz null;

comment on column public.kpi_history.archived_at is
  'When set, the history row is excluded from operational views. Soft-archive only; never delete.';

-- Confirmed Volymutveckling test report only (comment + value 50). Idempotent.
update public.kpi_history h
set
  archived_at = coalesce(h.archived_at, now()),
  updated_at = now()
where h.kpi_id = '689c066a-4fed-4746-8f9c-346775176e97'
  and h.archived_at is null
  and h.comment is not null
  and h.comment ilike '%test av daglig kpi-rapportering%'
  and replace(replace(btrim(h.value), ',', '.'), ' ', '') in ('50', '50.0');

-- Recompute snapshot from latest non-archived history. Clear value if none remain.
do $$
declare
  v_kpi_id constant uuid := '689c066a-4fed-4746-8f9c-346775176e97';
  v_value text;
  v_status text;
begin
  select h.value, h.status
  into v_value, v_status
  from public.kpi_history h
  where h.kpi_id = v_kpi_id
    and h.archived_at is null
  order by h.recorded_at desc, h.created_at desc, h.id desc
  limit 1;

  if found then
    update public.kpis
    set
      current_value = v_value,
      status = case
        when v_status in ('Grön', 'Gul', 'Röd', 'Statistik') then v_status
        else status
      end,
      trend = 'Oförändrad',
      updated_at = now()
    where id = v_kpi_id
      and (
        current_value is distinct from v_value
        or status is distinct from v_status
        or trend is distinct from 'Oförändrad'
      );
  else
    update public.kpis
    set
      current_value = null,
      trend = 'Oförändrad',
      updated_at = now()
    where id = v_kpi_id
      and (
        current_value is not null
        or trend is distinct from 'Oförändrad'
      );
  end if;
end;
$$;
