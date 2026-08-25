-- Övertid hours for every operational business area.
-- Alwex totalt is synthetic and deliberately excluded. No company rollup.
-- INSERT only: skip if an active row already exists. No history backfill.

do $$
declare
  v_area record;
  v_canonical_daily uuid;
  v_canonical_mtd uuid;
  v_daily_id uuid;
begin
  for v_area in
    select ba.id, ba.name, ba.slug
    from public.business_areas ba
    where ba.slug <> 'alwex-totalt'
      and lower(btrim(ba.name)) <> 'alwex totalt'
  loop
    v_canonical_daily := null;
    v_canonical_mtd := null;
    v_daily_id := null;

    select spec.daily_id, spec.mtd_id
    into v_canonical_daily, v_canonical_mtd
    from (
      values
        (
          'kyl-frys',
          'cd3371ca-1bc5-4dbc-b968-3562fb9baac6'::uuid,
          '0605b3b1-d6df-4984-b3d8-952b6dcb238e'::uuid,
          'b1fb2354-0f2d-4626-b28e-52ef3a96070d'::uuid
        ),
        (
          'lager-logistik',
          'd6fddf98-ef3d-4f35-9a16-bbc1b7d384c6'::uuid,
          'c7b603dc-5cc3-44d5-980e-0bd5838be3da'::uuid,
          '065dfa43-b54a-49f5-a019-11082bb8a598'::uuid
        ),
        (
          'fjarr-miljo',
          'a30b9d4d-d9d7-4975-b7da-413c907e5c3a'::uuid,
          '93488efe-7540-40db-9153-b47f61611790'::uuid,
          '5920bd91-aec5-4f12-b685-7889e155f086'::uuid
        ),
        (
          'mark-anlaggning',
          '550a4dc4-97a6-48fb-99b8-ef2e4c16b5a7'::uuid,
          '15197658-5dbc-4331-bad0-edf23c7a153e'::uuid,
          '814ad54c-0b5c-4939-bfdd-be8be8908144'::uuid
        ),
        (
          'recycling',
          '281ef37b-1195-4f40-ab9c-55757090e858'::uuid,
          '8088ace8-01cd-48c7-9e02-bbfdd480a4b0'::uuid,
          'ca9c6af9-f22f-406a-a92d-182d3688c3e2'::uuid
        ),
        (
          'intermodal',
          '21b2decb-51e6-4110-99b6-e2e5a6c0977e'::uuid,
          'c63f4f63-0fb5-4511-9b4d-d1eef26659c1'::uuid,
          'd7c6f52e-aa4b-4b3a-9a13-2b7c9901f90c'::uuid
        ),
        (
          'frotradet',
          'da129776-7230-41d5-871b-4d87820aa4d3'::uuid,
          'faa991aa-d60d-4d53-a167-8b67c9d71fdb'::uuid,
          'ebc03f93-188f-4ce5-b9d7-3ef2c6bd08a9'::uuid
        )
    ) as spec(slug, area_id, daily_id, mtd_id)
    where spec.slug = v_area.slug
       or spec.area_id = v_area.id
    limit 1;

    if v_canonical_daily is null or v_canonical_mtd is null then
      continue;
    end if;

    select k.id
    into v_daily_id
    from public.kpis k
    where k.business_area_id = v_area.id
      and k.archived_at is null
      and (k.id = v_canonical_daily or k.name = 'Övertid')
    order by case when k.id = v_canonical_daily then 0 else 1 end
    limit 1;

    if v_daily_id is null then
      insert into public.kpis (
        id, business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance, calc_operator,
        calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
      )
      values (
        v_canonical_daily, v_area.id, 'Övertid', 'Personal', null, null, 'h',
        'Statistik', 'Oförändrad', 'STATISTIC', null, null,
        null, null, null, null, null, 'DAILY'
      );
      v_daily_id := v_canonical_daily;
    end if;

    if not exists (
      select 1
      from public.kpis k
      where k.business_area_id = v_area.id
        and k.archived_at is null
        and (k.id = v_canonical_mtd or k.name = 'Övertid månad hittills')
    ) then
      insert into public.kpis (
        id, business_area_id, name, category, target_value, current_value, unit,
        status, trend, kpi_kind, direction, tolerance_type,
        green_tolerance, yellow_tolerance, calc_operator,
        calc_numerator_kpi_id, calc_denominator_kpi_id, reporting_frequency
      )
      values (
        v_canonical_mtd, v_area.id, 'Övertid månad hittills', 'Personal',
        null, null, 'h',
        'Statistik', 'Oförändrad', 'CALCULATED', null, null,
        null, null, 'MONTH_TO_DATE_SUM', v_daily_id, null, 'DAILY'
      );
    end if;
  end loop;
end;
$$;
