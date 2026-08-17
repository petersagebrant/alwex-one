-- Complete seed for Alwex One: business areas, goals and KPIs.
-- Idempotent via UPSERT (unique natural keys). Safe to re-run.

-- ---------------------------------------------------------------------------
-- Unique keys required for UPSERT of goals / KPIs
-- ---------------------------------------------------------------------------

create unique index if not exists goals_business_area_id_title_uidx
  on public.goals (business_area_id, title);

create unique index if not exists kpis_business_area_id_name_uidx
  on public.kpis (business_area_id, name);

-- ---------------------------------------------------------------------------
-- Affärsområden
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Mål (2 per affärsområde)
-- ---------------------------------------------------------------------------

insert into public.goals (
  business_area_id,
  title,
  description,
  owner,
  status,
  target_value,
  current_value,
  deadline,
  progress
)
select
  ba.id,
  seed.title,
  seed.description,
  seed.owner,
  seed.status,
  seed.target_value,
  seed.current_value,
  seed.deadline::date,
  seed.progress
from (
  values
    -- Kyl & Frys
    (
      'kyl-frys',
      'Leveransprecision över 99 %',
      'Säkra fortsatt hög leveransprecision i kyl- och frysflöden under året.',
      'Lars-Olof Larsson',
      'Grön',
      '≥ 99,0 %',
      '99,4 %',
      '2026-12-31',
      92
    ),
    (
      'kyl-frys',
      'Öka fyllnadsgrad i returflöden',
      'Förbättra fyllnadsgraden i returtransporter för bättre kapacitetsutnyttjande.',
      'Lars-Olof Larsson',
      'Gul',
      '≥ 85 %',
      '78 %',
      '2026-09-30',
      61
    ),
    -- Lager & Logistik
    (
      'lager-logistik',
      'Nå budgeterat resultat',
      'Stänga gapet mot budget genom kostnadskontroll och volymstabilitet.',
      'Carl Backler',
      'Gul',
      'Budget ±0',
      'Under uppföljning',
      '2026-12-31',
      45
    ),
    (
      'lager-logistik',
      'Höja beläggningsgraden i lagret',
      'Öka beläggningen genom bättre planering av yta och flöden.',
      'Carl Backler',
      'Gul',
      '≥ 90 %',
      '81 %',
      '2026-10-31',
      55
    ),
    -- Fjärr & Miljö
    (
      'fjarr-miljo',
      'Säkra planerade kundstarter',
      'Genomföra årets planerade kundstarter enligt tidplan.',
      'Charlotte Häggblad',
      'Gul',
      '4 starter',
      '3 starter',
      '2026-12-31',
      75
    ),
    (
      'fjarr-miljo',
      'Nå budgeterad volym YTD',
      'Följa upp och säkra volym i linje med budget under året.',
      'Charlotte Häggblad',
      'Gul',
      '100 % av budget',
      '96 % av budget',
      '2026-12-31',
      78
    ),
    -- Mark & Anläggning
    (
      'mark-anlaggning',
      'Minska budgetavvikelse i projekt',
      'Hålla projekt inom acceptabel budgetavvikelse genom tätare uppföljning.',
      'Glenn Petersson',
      'Gul',
      '≤ 2 %',
      '4,5 %',
      '2026-12-31',
      50
    ),
    (
      'mark-anlaggning',
      'Förbättra veckovis projektuppföljning',
      'Etablera stabil veckorutin för status, risker och nästa steg per projekt.',
      'Glenn Petersson',
      'Grön',
      'Veckovis uppföljning',
      'Införd',
      '2026-09-30',
      80
    ),
    -- Recycling
    (
      'recycling',
      'Stabilisera volymutveckling',
      'Bromsa negativ volymutveckling och återgå till stabil nivå.',
      'Sven-Göran Rohlin',
      'Gul',
      '≥ 0 % mot föregående år',
      'Under uppföljning',
      '2026-12-31',
      40
    ),
    (
      'recycling',
      'Säkra underlag för investeringsbeslut',
      'Ta fram komplett beslutsunderlag för prioriterade investeringar.',
      'Sven-Göran Rohlin',
      'Gul',
      'Beslutsunderlag klart',
      'Pågår',
      '2026-10-31',
      55
    ),
    -- Intermodal
    (
      'intermodal',
      'Bibehålla stabil leveranskvalitet',
      'Hålla leveransprecision och punktlighet på stabil nivå i intermodala flöden.',
      null,
      'Grön',
      '≥ 98,5 %',
      '98,9 %',
      '2026-12-31',
      88
    ),
    (
      'intermodal',
      'Öka andel intermodala flöden',
      'Öka andelen gods som går via intermodala lösningar under året.',
      null,
      'Gul',
      '+5 procentenheter',
      'Pågår',
      '2026-11-30',
      64
    ),
    -- Fröträdet
    (
      'frotradet',
      'Nå budgeterat årsresultat',
      'Följa upp intäkter och kostnader så att årsresultatet ligger i linje med budget.',
      'Kennert Sagebrant',
      'Grön',
      'Budget ±0',
      'Enligt plan',
      '2026-12-31',
      70
    ),
    (
      'frotradet',
      'Säkra driftskvalitet i produktionen',
      'Bibehålla stabil driftskvalitet och leveransförmåga i Fröträdets verksamhet.',
      'Kennert Sagebrant',
      'Grön',
      'Stabil drift',
      'Stabil',
      '2026-12-31',
      75
    )
) as seed (
  slug,
  title,
  description,
  owner,
  status,
  target_value,
  current_value,
  deadline,
  progress
)
inner join public.business_areas ba on ba.slug = seed.slug
on conflict (business_area_id, title) do update
set
  description = excluded.description,
  owner = excluded.owner,
  status = excluded.status,
  target_value = excluded.target_value,
  current_value = excluded.current_value,
  deadline = excluded.deadline,
  progress = excluded.progress,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- KPI:er (2 per affärsområde)
-- ---------------------------------------------------------------------------

insert into public.kpis (
  business_area_id,
  name,
  category,
  target_value,
  current_value,
  unit,
  status,
  trend
)
select
  ba.id,
  seed.name,
  seed.category,
  seed.target_value,
  seed.current_value,
  seed.unit,
  seed.status,
  seed.trend
from (
  values
    -- Kyl & Frys
    (
      'kyl-frys',
      'Leveransprecision',
      'Kvalitet',
      '97',
      '99,4',
      '%',
      'Grön',
      'Oförändrad'
    ),
    (
      'kyl-frys',
      'Resultat mot budget',
      'Ekonomi',
      '0',
      '0,6',
      'Mkr',
      'Grön',
      'Upp'
    ),
    -- Lager & Logistik
    (
      'lager-logistik',
      'Resultat mot budget',
      'Ekonomi',
      '0',
      '-0,4',
      'Mkr',
      'Gul',
      'Oförändrad'
    ),
    (
      'lager-logistik',
      'Beläggningsgrad',
      'Kapacitet',
      '90',
      '81',
      '%',
      'Gul',
      'Upp'
    ),
    -- Fjärr & Miljö
    (
      'fjarr-miljo',
      'Omsättning mot budget',
      'Ekonomi',
      '100',
      '96',
      '%',
      'Gul',
      'Oförändrad'
    ),
    (
      'fjarr-miljo',
      'Genomförda kundstarter',
      'Tillväxt',
      '4',
      '3',
      'st',
      'Gul',
      'Upp'
    ),
    -- Mark & Anläggning
    (
      'mark-anlaggning',
      'Budgetavvikelse',
      'Ekonomi',
      '2',
      '4,5',
      '%',
      'Gul',
      'Ner'
    ),
    (
      'mark-anlaggning',
      'Projekt i tid',
      'Leverans',
      '90',
      '86',
      '%',
      'Gul',
      'Oförändrad'
    ),
    -- Recycling
    (
      'recycling',
      'Volymutveckling',
      'Volym',
      '0',
      '-3',
      '%',
      'Gul',
      'Oförändrad'
    ),
    (
      'recycling',
      'Resultat mot budget',
      'Ekonomi',
      '0',
      '-0,3',
      'Mkr',
      'Gul',
      'Oförändrad'
    ),
    -- Intermodal
    (
      'intermodal',
      'Leveransprecision',
      'Kvalitet',
      '98,5',
      '98,9',
      '%',
      'Grön',
      'Oförändrad'
    ),
    (
      'intermodal',
      'Beläggning tågpendlar',
      'Kapacitet',
      '85',
      '82',
      '%',
      'Gul',
      'Upp'
    ),
    -- Fröträdet
    (
      'frotradet',
      'Resultat mot budget',
      'Ekonomi',
      '0',
      '0,1',
      'Mkr',
      'Grön',
      'Oförändrad'
    ),
    (
      'frotradet',
      'Leveransförmåga',
      'Kvalitet',
      '98',
      '98,2',
      '%',
      'Grön',
      'Oförändrad'
    )
) as seed (
  slug,
  name,
  category,
  target_value,
  current_value,
  unit,
  status,
  trend
)
inner join public.business_areas ba on ba.slug = seed.slug
on conflict (business_area_id, name) do update
set
  category = excluded.category,
  target_value = excluded.target_value,
  current_value = excluded.current_value,
  unit = excluded.unit,
  status = excluded.status,
  trend = excluded.trend,
  updated_at = now();
