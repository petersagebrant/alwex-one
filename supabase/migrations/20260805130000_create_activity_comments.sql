-- Migration: create activity_comments
-- Alwex One — kommentarer på aktiviteter

create table public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activity_comments_activity_id_idx
  on public.activity_comments (activity_id);

comment on table public.activity_comments is
  'Kommentarer kopplade till aktiviteter';

alter table public.activity_comments enable row level security;

-- DEVELOPMENT ONLY
-- Temporary RLS so the app can read/insert activity comments before auth
-- is implemented (client uses the anon/publishable key).
--
-- IMPORTANT: Remove these policies before production.
-- Replace with authenticated (or role-based) policies when login is live.

create policy "Development: anon can read activity_comments"
  on public.activity_comments
  for select
  to anon
  using (true);

create policy "Development: anon can insert activity_comments"
  on public.activity_comments
  for insert
  to anon
  with check (true);

-- TODO(production): drop the two policies above before go-live.
-- Example:
--   drop policy "Development: anon can read activity_comments" on public.activity_comments;
--   drop policy "Development: anon can insert activity_comments" on public.activity_comments;
