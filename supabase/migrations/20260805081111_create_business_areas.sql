-- Migration: create business_areas
-- Alwex One — första databastabellen

create extension if not exists pgcrypto;

create table public.business_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  manager text,
  status text not null default 'Gul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_areas_status_check
    check (status in ('Grön', 'Gul', 'Röd'))
);

comment on table public.business_areas is
  'Affärsområden i Alwex One';

comment on column public.business_areas.slug is
  'URL-vänlig unik nyckel, t.ex. kyl-frys';

comment on column public.business_areas.status is
  'Ledningsstatus: Grön, Gul eller Röd';

alter table public.business_areas enable row level security;

create policy "Authenticated users can read business_areas"
  on public.business_areas
  for select
  to authenticated
  using (true);
