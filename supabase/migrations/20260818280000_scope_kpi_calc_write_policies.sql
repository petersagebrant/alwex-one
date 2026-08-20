-- Scope KPI calculation-input writes to valid same-area relationships.
-- Read policies are intentionally untouched.

begin;

drop policy if exists kpi_calc_sum_numerators_write_authenticated
  on public.kpi_calc_sum_numerators;
drop policy if exists kpi_calc_weighted_inputs_write_authenticated
  on public.kpi_calc_weighted_inputs;

-- SUM_DIVIDE rows are writable only when the parent, numerator, and the
-- parent's denominator all belong to the same writable business area.
create policy kpi_calc_sum_numerators_insert_authenticated
  on public.kpi_calc_sum_numerators
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.kpis as parent
      join public.kpis as numerator
        on numerator.id = kpi_calc_sum_numerators.numerator_kpi_id
      join public.kpis as denominator
        on denominator.id = parent.calc_denominator_kpi_id
      where parent.id = kpi_calc_sum_numerators.parent_kpi_id
        and parent.calc_operator = 'SUM_DIVIDE'
        and numerator.business_area_id = parent.business_area_id
        and denominator.business_area_id = parent.business_area_id
        and public.can_write_operational(parent.business_area_id)
    )
  );

create policy kpi_calc_sum_numerators_update_authenticated
  on public.kpi_calc_sum_numerators
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.kpis as parent
      join public.kpis as numerator
        on numerator.id = kpi_calc_sum_numerators.numerator_kpi_id
      join public.kpis as denominator
        on denominator.id = parent.calc_denominator_kpi_id
      where parent.id = kpi_calc_sum_numerators.parent_kpi_id
        and parent.calc_operator = 'SUM_DIVIDE'
        and numerator.business_area_id = parent.business_area_id
        and denominator.business_area_id = parent.business_area_id
        and public.can_write_operational(parent.business_area_id)
    )
  )
  with check (
    exists (
      select 1
      from public.kpis as parent
      join public.kpis as numerator
        on numerator.id = kpi_calc_sum_numerators.numerator_kpi_id
      join public.kpis as denominator
        on denominator.id = parent.calc_denominator_kpi_id
      where parent.id = kpi_calc_sum_numerators.parent_kpi_id
        and parent.calc_operator = 'SUM_DIVIDE'
        and numerator.business_area_id = parent.business_area_id
        and denominator.business_area_id = parent.business_area_id
        and public.can_write_operational(parent.business_area_id)
    )
  );

create policy kpi_calc_sum_numerators_delete_authenticated
  on public.kpi_calc_sum_numerators
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.kpis as parent
      join public.kpis as numerator
        on numerator.id = kpi_calc_sum_numerators.numerator_kpi_id
      join public.kpis as denominator
        on denominator.id = parent.calc_denominator_kpi_id
      where parent.id = kpi_calc_sum_numerators.parent_kpi_id
        and parent.calc_operator = 'SUM_DIVIDE'
        and numerator.business_area_id = parent.business_area_id
        and denominator.business_area_id = parent.business_area_id
        and public.can_write_operational(parent.business_area_id)
    )
  );

-- WEIGHTED_RATIO_PERCENT rows may be local to one area, or may feed the
-- exact alwex-totalt parent. Cross-area global inputs additionally require
-- organization-level business-area management rights.
create policy kpi_calc_weighted_inputs_insert_authenticated
  on public.kpi_calc_weighted_inputs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.kpis as parent
      join public.business_areas as parent_area
        on parent_area.id = parent.business_area_id
      join public.kpis as numerator
        on numerator.id = kpi_calc_weighted_inputs.numerator_kpi_id
      join public.kpis as denominator
        on denominator.id = kpi_calc_weighted_inputs.denominator_kpi_id
      where parent.id = kpi_calc_weighted_inputs.parent_kpi_id
        and parent.calc_operator = 'WEIGHTED_RATIO_PERCENT'
        and numerator.business_area_id = denominator.business_area_id
        and (
          (
            parent.business_area_id = numerator.business_area_id
            and public.can_write_operational(numerator.business_area_id)
          )
          or (
            parent_area.slug = 'alwex-totalt'
            and parent.business_area_id <> numerator.business_area_id
            and public.can_manage_business_areas()
            and public.can_write_operational(numerator.business_area_id)
          )
        )
    )
  );

create policy kpi_calc_weighted_inputs_update_authenticated
  on public.kpi_calc_weighted_inputs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.kpis as parent
      join public.business_areas as parent_area
        on parent_area.id = parent.business_area_id
      join public.kpis as numerator
        on numerator.id = kpi_calc_weighted_inputs.numerator_kpi_id
      join public.kpis as denominator
        on denominator.id = kpi_calc_weighted_inputs.denominator_kpi_id
      where parent.id = kpi_calc_weighted_inputs.parent_kpi_id
        and parent.calc_operator = 'WEIGHTED_RATIO_PERCENT'
        and numerator.business_area_id = denominator.business_area_id
        and (
          (
            parent.business_area_id = numerator.business_area_id
            and public.can_write_operational(numerator.business_area_id)
          )
          or (
            parent_area.slug = 'alwex-totalt'
            and parent.business_area_id <> numerator.business_area_id
            and public.can_manage_business_areas()
            and public.can_write_operational(numerator.business_area_id)
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.kpis as parent
      join public.business_areas as parent_area
        on parent_area.id = parent.business_area_id
      join public.kpis as numerator
        on numerator.id = kpi_calc_weighted_inputs.numerator_kpi_id
      join public.kpis as denominator
        on denominator.id = kpi_calc_weighted_inputs.denominator_kpi_id
      where parent.id = kpi_calc_weighted_inputs.parent_kpi_id
        and parent.calc_operator = 'WEIGHTED_RATIO_PERCENT'
        and numerator.business_area_id = denominator.business_area_id
        and (
          (
            parent.business_area_id = numerator.business_area_id
            and public.can_write_operational(numerator.business_area_id)
          )
          or (
            parent_area.slug = 'alwex-totalt'
            and parent.business_area_id <> numerator.business_area_id
            and public.can_manage_business_areas()
            and public.can_write_operational(numerator.business_area_id)
          )
        )
    )
  );

create policy kpi_calc_weighted_inputs_delete_authenticated
  on public.kpi_calc_weighted_inputs
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.kpis as parent
      join public.business_areas as parent_area
        on parent_area.id = parent.business_area_id
      join public.kpis as numerator
        on numerator.id = kpi_calc_weighted_inputs.numerator_kpi_id
      join public.kpis as denominator
        on denominator.id = kpi_calc_weighted_inputs.denominator_kpi_id
      where parent.id = kpi_calc_weighted_inputs.parent_kpi_id
        and parent.calc_operator = 'WEIGHTED_RATIO_PERCENT'
        and numerator.business_area_id = denominator.business_area_id
        and (
          (
            parent.business_area_id = numerator.business_area_id
            and public.can_write_operational(numerator.business_area_id)
          )
          or (
            parent_area.slug = 'alwex-totalt'
            and parent.business_area_id <> numerator.business_area_id
            and public.can_manage_business_areas()
            and public.can_write_operational(numerator.business_area_id)
          )
        )
    )
  );

-- PUBLIC remains without privileges. Anonymous read access is unchanged, but
-- every table-level write/maintenance privilege is removed.
revoke all privileges
  on table public.kpi_calc_sum_numerators,
           public.kpi_calc_weighted_inputs
  from public;

revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.kpi_calc_sum_numerators,
           public.kpi_calc_weighted_inputs
  from anon;

-- RLS can authorize authenticated writes only when the underlying DML grants
-- exist, so retain exactly the four privileges needed by reads and policies.
grant select, insert, update, delete
  on table public.kpi_calc_sum_numerators,
           public.kpi_calc_weighted_inputs
  to authenticated;

revoke truncate, references, trigger, maintain
  on table public.kpi_calc_sum_numerators,
           public.kpi_calc_weighted_inputs
  from authenticated;

commit;
