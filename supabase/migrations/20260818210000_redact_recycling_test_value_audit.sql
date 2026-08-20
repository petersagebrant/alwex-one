-- Remove the confirmed Recycling test value from operational audit displays.
-- Keep the audit row itself; only replace the test-value details.
update public.audit_log
set
  description = 'Rensade bekräftad testdata för KPI:n "Volymutveckling".',
  changes = null
where id = 'ced07638-6477-4af8-8fde-2d3bec3d3896'
  and entity_type = 'kpi'
  and entity_id = '689c066a-4fed-4746-8f9c-346775176e97'
  and (
    coalesce(changes::text, '') like '%"to": "50"%'
    or description like '%→ 50%'
  );
