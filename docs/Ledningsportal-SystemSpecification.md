# Systemspecifikation — Alwex Ledningsportal

| Fält | Värde |
| --- | --- |
| Dokument | `docs/SystemSpecification.md` |
| Produktnamn | Alwex Ledningsportal (Målportal) |
| Version | 0.1.0 (MVP / prototyp) |
| Status | Under utveckling |
| Senast uppdaterad | 2026-08-04 |
| Primär intressent | VD / koncernledning |
| Kodbas | `alwex-malportal` |

---

## 1. Syfte

Alwex Ledningsportal är en intern webbaserad ledningsvy för **målbild och verksamhetsuppföljning**. Systemet ska ge VD och ledning en snabb, gemensam bild av:

- koncernens nyckeltal mot budget och prognos
- status per affärsområde
- frågor som kräver ledningens uppmärksamhet
- kommande beslut
- mål som kräver åtgärd

Portalen är tänkt att bli navet för uppföljning av målbilder per affärsområde, med möjlighet att gå från översikt till detalj.

---

## 2. Omfattning

### 2.1 Inom scope (nuvarande MVP)

- Startsida / VD-dashboard
- Visning av koncernnyckeltal
- Översikt över sex affärsområden
- Ledningslistor (uppmärksamhet + kommande beslut)
- Tabell över mål som kräver åtgärd
- Responsiv layout (dator, iPad, mobil)
- Svenskt språk och affärsmässig UI-design

### 2.2 Utanför scope (tills vidare)

- Autentisering och behörighetsstyrning
- Koppling till ERP / ekonomi / BI
- Redigering av mål, status eller kommentarer i UI
- Historik, trender och drill-down
- Notiser, e-post eller arbetsflöden för beslut
- Mobilapp (native)

---

## 3. Användare och roller

| Roll | Beskrivning | Behov i portalen |
| --- | --- | --- |
| VD | Övergripande ansvar för koncernen | Snabb status, avvikelser, beslutspunkter |
| Affärsområdeschef | Ansvarig för ett affärsområde | Se egen målbild, status och åtgärder |
| Controller / ekonomi | Stödjer uppföljning | Säkerställa korrekta nyckeltal och prognoser |
| Ledningsstöd | Förbereder underlag | Uppdatera beslutspunkter och åtgärdslistor |

**Nuvarande prototyp:** ingen inloggning. Användarrutan visar exempelidentitet *Peter Sagebrant, VD*.

---

## 4. Affärsobjekt

### 4.1 Affärsområden

Fasta affärsområden i nuvarande version:

| ID | Namn | Ansvarig (prototypdata) |
| --- | --- | --- |
| `kyl-frys` | Kyl & Frys | Lars-Olof Larsson |
| `lager-logistik` | Lager & Logistik | Carl Backler |
| `fjarr-miljo` | Fjärr & Miljö | Charlotte Häggblad |
| `mark-anlaggning` | Mark & Anläggning | Glenn Petersson |
| `recycling` | Recycling | Sven-Göran Rohlin |
| `intermodal` | Intermodal | Alwex Intermodal |

Varje affärsområde har minst:

- namn
- ansvarig
- status (`Grön` \| `Gul` \| `Röd`)
- kort kommentar / bedömning
- länk/åtgärd: *Öppna målbild* (UI finns; detaljsida saknas ännu)

### 4.2 Statusmodell

| Status | Betydelse (arbetshypotes) |
| --- | --- |
| Grön | Enligt plan / acceptabel avvikelse |
| Gul | Avvikelse eller risk som kräver bevakning |
| Röd | Allvarlig avvikelse som kräver ledningsåtgärd |

Status används på nyckeltal, affärsområden och åtgärdsmål.

### 4.3 Koncernnyckeltal (KPI)

Nuvarande KPI:er på startsidan:

| KPI | Exempelvärde | Status |
| --- | --- | --- |
| Resultat mot budget | +1,8 Mkr | Grön |
| Omsättning mot budget | 98 % | Gul |
| Leveransprecision | 99,3 % | Grön |
| Prognos helår | +8,0 Mkr | Grön |

### 4.4 Ledningsobjekt

- **Uppmärksamhetspost:** affärsområde + kort beskrivning av problem
- **Kommande beslut:** beslutspunkt för ledningen
- **Åtgärdsmål:** mål, affärsområde, ansvarig, deadline, status

---

## 5. Funktionell beskrivning — nuvarande lösning

### 5.1 Startsida (VD-dashboard)

Startsida renderas i `app/page.tsx` och består av:

1. **Toppmeny (mörk)**
   - Produktnamn: *ALWEX Ledningsportal*
   - Undertitel: *Målbild och verksamhetsuppföljning*
   - Användarruta: *Peter Sagebrant, VD*
2. **Nyckeltalskort** — fyra KPI-kort med värde och status
3. **Affärsområden** — sex kort med namn, ansvarig, status, kommentar och knapp *Öppna målbild*
4. **Två kolumner**
   - Vänster: *Kräver ledningens uppmärksamhet*
   - Höger: *Kommande beslut*
5. **Tabell** — *Mål som kräver åtgärd* med kolumnerna Mål, Affärsområde, Ansvarig, Deadline, Status

### 5.2 Datahantering (MVP)

All presentationsdata är **hårdkodad i klientkomponenten** (`app/page.tsx`). Det finns ännu ingen databas, API-lager eller externa integrationer.

### 5.3 Interaktion

- Knappen *Öppna målbild* är synlig men har ingen navigering/detaljsida ännu.
- Inga formulär, filter eller sortering i MVP.

---

## 6. Icke-funktionella krav

| Område | Krav |
| --- | --- |
| Plattform | Modern webb, responsiv |
| Teknik | TypeScript, Next.js App Router, Tailwind CSS |
| Prestanda | Snabb first paint för dashboard; lokal data i MVP |
| Tillgänglighet | Semantisk struktur, tydlig statusmarkering, tangentbordsvänliga knappar |
| Språk | Svenska |
| Design | Professionellt ledningssystem: ljus bakgrund, vita kort, diskreta skuggor, rundade hörn |
| Drift (utveckling) | `npm run dev` → `http://localhost:3000` |

---

## 7. Teknisk arkitektur

### 7.1 Stack

| Lager | Val |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack i dev) |
| UI | React 19 + Tailwind CSS 4 |
| Språk | TypeScript |
| Pakethantering | npm |
| Versionshantering | Git |

### 7.2 Projektstruktur (relevant)

```text
alwex-malportal/
├── app/
│   ├── page.tsx          # VD-dashboard (huvudvy)
│   ├── layout.tsx        # Root layout, metadata, fonts
│   ├── globals.css       # Global stil
│   └── favicon.ico
├── docs/
│   └── SystemSpecification.md
├── public/
├── package.json
└── ...
```

### 7.3 Föreslagen målarkitektur (nästa steg)

```text
UI (App Router)
  → Domain services / server actions
    → Data access (DB eller API-klient)
      → Källsystem (ekonomi, BI, manuellt register)
```

Rekommenderad uppdelning i kod:

- `app/` — sidor och layouts
- `components/` — återanvändbara UI-komponenter
- `lib/` eller `domain/` — typer, statuslogik, mappningar
- `data/` eller databas — affärsområden, KPI, mål, beslut

---

## 8. Informationsmodell (målbild)

Föreslagna entiteter för fortsatt utveckling:

### BusinessArea

| Attribut | Typ | Beskrivning |
| --- | --- | --- |
| id | string | Stabil nyckel |
| name | string | Visningsnamn |
| managerName | string | Ansvarig chef |
| status | enum | Grön/Gul/Röd |
| comment | string | Kort ledningskommentar |
| updatedAt | datetime | Senast uppdaterad |

### KpiSnapshot

| Attribut | Typ | Beskrivning |
| --- | --- | --- |
| id | string | Nyckeltalets id |
| label | string | Rubrik |
| value | string/number | Visningsvärde |
| unit | string | t.ex. Mkr, % |
| status | enum | Grön/Gul/Röd |
| period | string | t.ex. YTD, månad |

### Goal

| Attribut | Typ | Beskrivning |
| --- | --- | --- |
| id | string | |
| title | string | Målformulering |
| businessAreaId | string | Koppling till AO |
| ownerName | string | Ansvarig |
| deadline | date | |
| status | enum | |
| requiresAction | boolean | Visas i åtgärdstabell |

### AttentionItem / DecisionItem

| Attribut | Typ | Beskrivning |
| --- | --- | --- |
| id | string | |
| title/text | string | |
| businessAreaId | string? | Valfri koppling |
| priority | number? | Sortering |
| dueDate | date? | För beslut |

---

## 9. Skärmar och navigering (målbild)

| Vy | Syfte | Status |
| --- | --- | --- |
| VD-dashboard (`/`) | Koncernöversikt | Implementerad (prototypdata) |
| Affärsområde — målbild (`/areas/[id]`) | Detaljerad målbild per AO | Ej påbörjad |
| Målregister | Lista/filtrera alla mål | Ej påbörjad |
| Beslutslista | Hantera kommande beslut | Ej påbörjad |
| Administration | Användare, AO, KPI-definitioner | Ej påbörjad |

**Navigationsprincip:** Dashboard → *Öppna målbild* → affärsområdessida → specifikt mål.

---

## 10. Roadmap

### Fas 0 — Klar (prototyp)

- [x] Next.js-projekt uppsatt
- [x] VD-dashboard med KPI, AO-kort, ledningslistor och åtgärdstabell
- [x] Systemspecifikation etablerad

### Fas 1 — Strukturera koden

- [ ] Bryt ut typer och mockdata från `page.tsx`
- [ ] Skapa återanvändbara komponenter (Header, KpiCard, AreaCard, StatusPill, ActionTable)
- [ ] Inför routing till affärsområdessida (även med mockdata)
- [ ] Enhetlig statuskomponent och design tokens

### Fas 2 — Domän och data

- [ ] Definiera canonical datamodell
- [ ] Ersätt hårdkodad data med lokalt JSON/MD eller enkel databas
- [ ] CRUD för mål, kommentarer och beslut (minst admin-nivå)
- [ ] Tydliga regler för hur status beräknas eller sätts manuellt

### Fas 3 — Ledningsprocess

- [ ] Detaljerad målbild per affärsområde
- [ ] Filter/sortering på åtgärdstabell
- [ ] Historik och periodval för KPI
- [ ] Export till PDF/Excel för ledningsmöte

### Fas 4 — Integration och drift

- [ ] Autentisering (t.ex. Microsoft Entra ID)
- [ ] Rollbaserad behörighet
- [ ] Integration mot ekonomi/BI där det är motiverat
- [ ] Loggning, miljöer (dev/stage/prod) och backup

---

## 11. Öppna frågor

1. Ska status sättas manuellt av ansvarig chef, eller beräknas från KPI-trösklar?
2. Vilken period är default för dashboarden (månad, YTD, rullande 12)?
3. Ska Intermodals ansvariga visas som bolagsnamn eller person?
4. Vilka nyckeltal är “sanning” vs. kompletterande indikatorer?
5. Behöver portalen stödja flera koncernbolag / juridiska enheter?
6. Vilken inloggningslösning ska användas internt?

---

## 12. Acceptanskriterier för nästa leverans (förslag)

En leverans anses klar när:

1. Startsida visar samma informationsstruktur som idag, men med data från en separat datakälla (inte inline i JSX).
2. *Öppna målbild* leder till en dedikerad sida per affärsområde.
3. Statusvisning är konsekvent i kort, listor och tabell.
4. Lösningen är responsiv och fungerar på mobil, iPad och desktop.
5. Denna systemspecifikation är uppdaterad med eventuella avvikelser.

---

## 13. Referenser

- Applikation: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`
- Produktmetadata: `package.json` (`alwex-malportal@0.1.0`)
- Next.js App Router-dokumentation: `node_modules/next/dist/docs/01-app/`
- Extern docs: https://nextjs.org/docs

---

*Dokumentet är levande och ska uppdateras i takt med att portalen utvecklas.*
