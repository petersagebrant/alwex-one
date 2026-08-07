-- Seed / update Alwex One business areas (business_areas only).
-- Idempotent: inserts missing rows by slug; updates name, description, manager.
-- Status "Grön" applies only on insert (new rows).

insert into public.business_areas (name, slug, description, manager, status)
values
  (
    'Kyl & Frys',
    'kyl-frys',
    'Temperaturkontrollerad logistik och distribution för kyl- och frysgods.',
    'Lars-Olof Larsson',
    'Grön'
  ),
  (
    'Lager & Logistik',
    'lager-logistik',
    'Lagertjänster, plock, pack och distributionslösningar.',
    'Carl Backler',
    'Grön'
  ),
  (
    'Fjärr & Miljö',
    'fjarr-miljo',
    'Fjärrtransporter och miljörelaterade uppdrag.',
    'Charlotte Häggblad',
    'Grön'
  ),
  (
    'Mark & Anläggning',
    'mark-anlaggning',
    'Markarbeten och anläggningstjänster.',
    'Glenn Petersson',
    'Grön'
  ),
  (
    'Recycling',
    'recycling',
    'Återvinning och materialflöden.',
    'Sven-Göran Rohlin',
    'Grön'
  ),
  (
    'Intermodal',
    'intermodal',
    'Kombinerade transporter i det intermodala nätverket.',
    null,
    'Grön'
  ),
  (
    'Fröträdet',
    'frotradet',
    'Verksamhet inom Fröträdet.',
    'Kennert Sagebrant',
    'Grön'
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  manager = excluded.manager,
  updated_at = now();
