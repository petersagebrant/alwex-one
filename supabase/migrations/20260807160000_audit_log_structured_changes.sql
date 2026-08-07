-- Migration: add structured change payload to audit_log
-- Alwex One — historikmotor
--
-- Reuses existing audit_log. Adds optional JSONB `changes` so trend analysis
-- can compare old/new values without a separate history table.
-- Shape:
-- {
--   "fields": [
--     { "field": "status", "from": "Gul", "to": "Röd" },
--     { "field": "current_value", "from": "90", "to": "81" }
--   ]
-- }

alter table public.audit_log
  add column if not exists changes jsonb;

comment on column public.audit_log.changes is
  'Strukturerade fältändringar (from/to) för trendanalys';

create index if not exists audit_log_changes_gin_idx
  on public.audit_log
  using gin (changes);
