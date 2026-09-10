-- Multiple escalation Q&A rows per activity. Local-only until deployed.
-- activities.requires_escalation stays a convenience flag for an unanswered row.

begin;

create table public.activity_escalations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  question text not null,
  asked_by uuid references public.profiles (id) on delete set null,
  asked_by_name text not null,
  asked_at timestamptz not null default now(),
  reply text null,
  replied_by uuid references public.profiles (id) on delete set null,
  replied_by_name text null,
  replied_at timestamptz null,
  status text not null default 'open',
  created_at timestamptz not null default now(),

  constraint activity_escalations_status_check
    check (status in ('open', 'answered')),
  constraint activity_escalations_answered_check
    check (
      (
        status = 'open'
        and reply is null
        and replied_by is null
        and replied_by_name is null
        and replied_at is null
      )
      or (
        status = 'answered'
        and reply is not null
        and replied_by_name is not null
        and replied_at is not null
      )
    )
);

comment on table public.activity_escalations is
  'Escalation question/answer history for a steering activity. One open row at a time.';

create index activity_escalations_activity_id_idx
  on public.activity_escalations (activity_id, asked_at);

create index activity_escalations_open_idx
  on public.activity_escalations (status, asked_at desc)
  where status = 'open';

create unique index activity_escalations_one_open_per_activity
  on public.activity_escalations (activity_id)
  where status = 'open';

insert into public.activity_escalations (
  activity_id,
  question,
  asked_by_name,
  asked_at,
  status
)
select
  a.id,
  a.escalation_note,
  coalesce(nullif(trim(a.owner), ''), 'Okänd'),
  coalesce(a.escalated_at, a.updated_at, a.created_at),
  'open'
from public.activities a
where a.requires_escalation = true
  and a.escalation_note is not null
  and length(trim(a.escalation_note)) > 0
  and not exists (
    select 1
    from public.activity_escalations e
    where e.activity_id = a.id
      and e.status = 'open'
  );

alter table public.activity_escalations enable row level security;

create policy "Role: read activity_escalations"
  on public.activity_escalations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.activities a
      where a.id = activity_escalations.activity_id
        and public.can_read_business_area(a.business_area_id)
    )
  );

create policy "Role: insert activity_escalations"
  on public.activity_escalations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.activities a
      where a.id = activity_escalations.activity_id
        and public.can_write_operational(a.business_area_id)
    )
  );

-- VD / Vice VD answer all areas. Admin follows existing write-all-areas pattern.
-- AO-chef can insert (escalate) but cannot update (answer).
create policy "Role: update activity_escalations"
  on public.activity_escalations
  for update
  to authenticated
  using (
    public.is_vd_equivalent()
    or public.has_app_role(array['administrator']::public.app_role[])
  )
  with check (
    public.is_vd_equivalent()
    or public.has_app_role(array['administrator']::public.app_role[])
  );

revoke all on table public.activity_escalations from public;
revoke all on table public.activity_escalations from anon;
grant select, insert, update on table public.activity_escalations to authenticated;

commit;
