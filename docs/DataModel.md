# Datamodell — Alwex One

| Fält | Värde |
| --- | --- |
| Produkt | Alwex One |
| Dokument | `docs/DataModel.md` |
| Relaterat | `docs/SystemSpecification.md`, `docs/ProductBacklog.md` |
| Status | Konceptuell modell (ingen databas ännu) |
| Version | 0.1 |
| Senast uppdaterad | 2026-08-05 |

Detta dokument beskriver den logiska datamodellen för Alwex One. Det skapar ingen databas och ändrar ingen programkod. Svenska begrepp används i texten; föreslagna engelska **tabellnamn** anges för framtida implementation.

---

## Principer

1. **Flera bolag och affärsområden** — modellen stödjer koncernstruktur med flera juridiska enheter och AO under respektive bolag (eller delade AO där det behövs).
2. **Månadsutfall skrivs aldrig över** — KPI-utfall lagras per rapporteringsperiod som egna rader (`kpi_results`).
3. **Ansvar och status** — varje mål och aktivitet har ansvarig användare samt status.
4. **Spårbarhet** — betydande ändringar historikförs via `history_events` (och vid behov versionsfält på objekten).
5. **Rollbaserad åtkomst** — minst: Administratör, VD, Ledningsgrupp, AO-chef, Målansvarig, Läsbehörig.

---

## Gemensamma fält (konvention)

Följande fält föreslås där det är relevant på de flesta entiteter:

| Svenskt begrepp | Engelskt fält | Beskrivning |
| --- | --- | --- |
| Id | `id` | Primärnyckel (UUID eller motsvarande) |
| Skapad | `created_at` | Tidsstämpel |
| Skapad av | `created_by` | Referens till användare |
| Uppdaterad | `updated_at` | Tidsstämpel |
| Uppdaterad av | `updated_by` | Referens till användare |
| Aktiv | `is_active` | Soft delete / arkivering |

---

## 1. Organisation

**Tabellnamn:** `organizations`

### Syfte
Representerar koncernen eller den översta organisatoriska enheten som äger Alwex One-instansen (t.ex. Alwex-koncernen).

### Viktigaste fält
- `id`
- `name` — visningsnamn
- `legal_name` — juridisk benämning (valfritt)
- `code` — kort kod
- `settings_json` — portalinställningar (valfritt)

### Relationer
- Har många **Bolag** (`companies`)
- Har många **Användare** (via medlemskap/roller, se `user_roles`)
- Har många **Rapporter** och **Dokument** på koncernnivå

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | Administratör |
| Läsa | Alla autentiserade roller |
| Ändra | Administratör |

### Historik
Namnbyte, organisationskod och väsentliga inställningsändringar.

---

## 2. Bolag

**Tabellnamn:** `companies`

### Syfte
Juridisk eller redovisningsmässig enhet under organisationen. Möjliggör flera bolag i samma portal.

### Viktigaste fält
- `id`
- `organization_id`
- `name`
- `code`
- `org_number` — organisationsnummer (valfritt)
- `is_active`

### Relationer
- Tillhör en **Organisation**
- Har många **Affärsområden**
- Kan ha egna **KPI**, **Rapporter**, **Dokument**
- Användare får behörighet per bolag via `user_roles`

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | Administratör |
| Läsa | VD, Ledningsgrupp, Administratör; övriga inom tilldelat bolag |
| Ändra | Administratör |

### Historik
Namn, kod, aktivering/inaktivering.

---

## 3. Affärsområde

**Tabellnamn:** `business_areas`

### Syfte
Uppföljningsenhet för målbild och verksamhet (t.ex. Kyl & Frys, Lager & Logistik, Fastighet).

### Viktigaste fält
- `id`
- `company_id`
- `slug` — URL-vänlig nyckel
- `name`
- `description`
- `manager_user_id` — AO-chef
- `status` — t.ex. Grön / Gul / Röd
- `updated_at`

### Relationer
- Tillhör ett **Bolag**
- Har många **Mål**, **KPI**, **Aktiviteter**, **Beslut**, **Kommentarer**, **Historikhändelser**
- Kan ha **Dokument** och **Rapporter**

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | Administratör |
| Läsa | VD, Ledningsgrupp, Administratör; AO-chef/Målansvarig/Läsbehörig för tilldelat AO |
| Ändra (metadata, status, beskrivning) | Administratör, AO-chef (eget AO); VD/Ledningsgrupp enligt policy |

### Historik
Statusändringar, byte av ansvarig, beskrivningsändringar av betydelse, aktivering/inaktivering.

---

## 4. Användare

**Tabellnamn:** `users`

### Syfte
Personer som loggar in och agerar i systemet (VD, chefer, målansvariga m.fl.).

### Viktigaste fält
- `id`
- `organization_id`
- `email`
- `display_name`
- `title` — t.ex. VD
- `external_auth_id` — koppling till IdP (framtida)
- `is_active`

### Relationer
- Tillhör en **Organisation**
- Har många **Rolltilldelningar** (`user_roles`)
- Kan vara ansvarig för **Affärsområde**, **Mål**, **Aktivitet**, **Beslut**
- Skapar **Kommentarer**, **Dokument**, **Historikhändelser**

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | Administratör |
| Läsa | Administratör, VD, Ledningsgrupp; begränsad profilsynlighet för övriga |
| Ändra | Administratör; användaren själv (begränsade profilfält) |

### Historik
Aktivering/inaktivering, namn/e-post av betydelse, byte av extern identitetskoppling.

---

## 5. Roll

**Tabellnamn:** `roles`  
**Tilldelning:** `user_roles` (kopplingstabell)

### Syfte
Definierar behörighetsnivå. Minst följande systemroller ska finnas:

| Svensk roll | Föreslagen `code` |
| --- | --- |
| Administratör | `admin` |
| VD | `ceo` |
| Ledningsgrupp | `leadership` |
| AO-chef | `area_manager` |
| Målansvarig | `goal_owner` |
| Läsbehörig | `reader` |

### Viktigaste fält (`roles`)
- `id`
- `code`
- `name`
- `description`
- `is_system_role`

### Viktigaste fält (`user_roles`)
- `id`
- `user_id`
- `role_id`
- `organization_id` (valfritt scope)
- `company_id` (valfritt scope)
- `business_area_id` (valfritt scope — krävs ofta för AO-chef / Målansvarig / Läsbehörig)
- `valid_from` / `valid_to` (valfritt)

### Relationer
- **Roll** tilldelas **Användare** med valfritt scope mot Organisation / Bolag / Affärsområde

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa/ändra rolldefinitioner | Administratör |
| Tilldela roller | Administratör |
| Läsa egna tilldelningar | Alla autentiserade |

### Historik
Alla tilldelningar och återkallelser av roller; ändringar av systemroller.

---

## 6. Mål

**Tabellnamn:** `goals`

### Syfte
Formulerad målbild som ska följas upp, med ansvarig och status.

### Viktigaste fält
- `id`
- `business_area_id`
- `company_id` (denormaliserat eller härlett — för filtrering)
- `title`
- `description`
- `owner_user_id` — **obligatorisk ansvarig**
- `status` — **obligatorisk** (t.ex. Grön / Gul / Röd eller Öppen / Pågår / Klar — fastställs i implementation)
- `deadline`
- `progress_percent` (valfritt)
- `requires_action` (bool)
- `period_code` (valfritt — t.ex. vilket år/målcykel)

### Relationer
- Tillhör ett **Affärsområde** (och indirekt **Bolag**)
- Har ansvarig **Användare**
- Har många **Aktiviteter**, **Kommentarer**, **Historikhändelser**
- Kan kopplas till **KPI** (via `goal_kpis` vid behov)

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | AO-chef, Administratör; Målansvarig enligt policy |
| Läsa | VD, Ledningsgrupp, Administratör; AO-scoped roller för aktuellt AO |
| Ändra | Ansvarig (Målansvarig), AO-chef, Administratör; VD/Ledningsgrupp enligt policy |

### Historik
Status, ansvarig, deadline, titel/beskrivning av betydelse, progress vid milstolpar.

---

## 7. KPI

**Tabellnamn:** `kpis`

### Syfte
Definition av ett nyckeltal (vad som mäts), inte själva månadsvärdet.

### Viktigaste fält
- `id`
- `business_area_id` och/eller `company_id` (scope)
- `code`
- `name` / `label`
- `description`
- `unit` — t.ex. `%`, `Mkr`
- `direction` — higher_is_better / lower_is_better (valfritt)
- `default_target_value` (valfritt)
- `is_active`

### Relationer
- Tillhör **Affärsområde** och/eller **Bolag**
- Har många **KPI-utfall** (`kpi_results`)
- Kan kopplas till **Mål**

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | Administratör; controller-liknande roll via Administratör tills egen roll finns |
| Läsa | Enligt scope (VD/Ledningsgrupp brett; övriga inom tilldelning) |
| Ändra definition | Administratör |

### Historik
Ändring av definition, enhet, målriktning, aktivering/inaktivering.  
**Obs:** Själva utfallen historikförs som egna periodrader — inte genom att skriva över definitionen.

---

## 8. KPI-utfall per rapporteringsperiod

**Tabellnamn:** `kpi_results`

### Syfte
Lagra faktiskt utfall för en KPI under en given rapporteringsperiod (t.ex. månad).  
**Regel:** Befintligt utfall för en period får **inte** skrivas över tyst. Korrigering sker genom ny version/rad eller explicit korrigeringspost med spårbarhet.

### Viktigaste fält
- `id`
- `kpi_id`
- `period_type` — t.ex. `month`
- `period_key` — t.ex. `2026-08` (år-månad)
- `period_start` / `period_end` (valfritt, härledbart)
- `actual_value`
- `target_value` (periodens mål, kan avvika från default)
- `status` — Grön / Gul / Röd (beräknad eller manuell)
- `comment` (kort, valfritt)
- `version` — vid korrigering (börja på 1)
- `supersedes_result_id` — pekar på ersatt rad vid korrigering (valfritt)
- `recorded_by` / `recorded_at`

### Relationer
- Tillhör en **KPI**
- Indirekt **Affärsområde** / **Bolag**
- Kan refereras från **Rapporter** och **Historikhändelser**

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa (nytt periodutfall) | AO-chef, Administratör; övriga enligt policy |
| Läsa | Enligt KPI-/AO-scope |
| Ändra | **Inte** fri uppdatering av `actual_value`. Korrigering = ny version (Administratör/AO-chef) |

### Historik
Varje skapat utfall är i sig historik. Korrigeringar skapar ny version + `history_events`. Statusändringar på utfall loggas.

### Unikhetsregel (förslag)
Unik aktiv version per (`kpi_id`, `period_type`, `period_key`, `version`) eller motsvarande constraint som förhindrar tyst overwrite.

---

## 9. Aktivitet

**Tabellnamn:** `activities`

### Syfte
Konkret åtgärd kopplad till mål, avvikelse eller beslut. Har alltid ansvarig och status.

### Viktigaste fält
- `id`
- `business_area_id`
- `goal_id` (valfritt men rekommenderat)
- `decision_id` (valfritt)
- `title`
- `description`
- `owner_user_id` — **obligatorisk ansvarig**
- `status` — **obligatorisk** (t.ex. Öppen / Pågår / Klar)
- `priority` (valfritt, kan återanvända Grön/Gul/Röd)
- `due_date`
- `completed_at`

### Relationer
- Tillhör **Affärsområde**
- Kan tillhöra **Mål** och/eller **Beslut**
- Har ansvarig **Användare**
- Har **Kommentarer** och **Historikhändelser**

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | AO-chef, Målansvarig, Administratör |
| Läsa | Enligt AO-scope; VD/Ledningsgrupp brett |
| Ändra | Ansvarig, AO-chef, Administratör |

### Historik
Status, ansvarig, förfallodatum, stängning/återöppning.

---

## 10. Kommentar

**Tabellnamn:** `comments`

### Syfte
Diskussion och kvalitativ bedömning knuten till mål, aktivitet, AO, beslut eller KPI-utfall.

### Viktigaste fält
- `id`
- `author_user_id`
- `body`
- `entity_type` — t.ex. `goal` \| `activity` \| `business_area` \| `decision` \| `kpi_result`
- `entity_id`
- `is_pinned` (valfritt)
- `created_at`

### Relationer
- Skriven av **Användare**
- Polymorf koppling till flera objekttyper

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | Alla utom ren Läsbehörig (eller Läsbehörig utan skriv — policy) |
| Läsa | Samma läsrätt som underliggande objekt |
| Ändra | Författare (begränsad tid), Administratör |

### Historik
Redigering och radering av kommentarer ska loggas (innehåll före/efter eller tombstone).

---

## 11. Beslut

**Tabellnamn:** `decisions`

### Syfte
Ledningens beslutspunkter och fattade beslut (t.ex. bemanning, investering).

### Viktigaste fält
- `id`
- `company_id` / `business_area_id` (valfritt scope)
- `title`
- `description`
- `status` — t.ex. Kommande / Under beredning / Beslutat / Parkerat
- `owner_user_id`
- `due_date`
- `decided_at`
- `decision_outcome` (valfritt)

### Relationer
- Kan kopplas till **Bolag** / **Affärsområde**
- Kan generera **Aktiviteter**
- Har **Kommentarer**, **Dokument**, **Historikhändelser**

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | VD, Ledningsgrupp, Administratör, AO-chef (AO-scopade) |
| Läsa | VD, Ledningsgrupp, Administratör; AO-roller för egna beslut |
| Ändra | VD, Ledningsgrupp, Administratör; ägare enligt statusregler |

### Historik
Statusövergångar, beslututfall, byte av ansvarig, datum.

---

## 12. Rapport

**Tabellnamn:** `reports`

### Syfte
Sammanställd vy eller exporterbart underlag för ledningsmöte / perioduppföljning.

### Viktigaste fält
- `id`
- `organization_id` / `company_id` / `business_area_id` (scope)
- `title`
- `report_type` — t.ex. `leadership_pack`, `area_status`
- `period_key`
- `status` — Utkast / Publicerad
- `generated_at`
- `generated_by`
- `payload_json` eller länk till **Dokument**

### Relationer
- Tillhör Organisation / Bolag / AO
- Kan referera många **KPI-utfall**, **Mål**, **Beslut**
- Kan ha bifogat **Dokument**

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | VD, Ledningsgrupp, Administratör, AO-chef (eget AO) |
| Läsa | Enligt scope och publiceringsstatus |
| Ändra | Skapare, Administratör; publicerad rapport låses eller versionshanteras |

### Historik
Publicering, ny version, ändring av periodurval.

---

## 13. Dokument

**Tabellnamn:** `documents`

### Syfte
Filer och bilagor (PDF, Excel, presentationer) kopplade till AO, beslut, rapport m.m.

### Viktigaste fält
- `id`
- `title`
- `file_name`
- `storage_uri`
- `mime_type`
- `size_bytes`
- `uploaded_by`
- `entity_type` / `entity_id` (polymorf koppling)
- `company_id` / `business_area_id` (scope för behörighet)

### Relationer
- Uppladdad av **Användare**
- Kopplas till **Rapport**, **Beslut**, **Affärsområde**, m.fl.

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa (ladda upp) | AO-chef, Ledningsgrupp, VD, Administratör, Målansvarig enligt scope |
| Läsa | Samma läsrätt som underliggande objekt |
| Ändra / ersätta | Uppladdare, Administratör (ersättning = ny version rekommenderas) |

### Historik
Uppladdning, ersättning (ny version), radering/arkivering.

---

## 14. Historikhändelse

**Tabellnamn:** `history_events`

### Syfte
Gemensam spårningslogg för betydande ändringar i systemet.

### Viktigaste fält
- `id`
- `entity_type`
- `entity_id`
- `event_type` — t.ex. `status_changed`, `owner_changed`, `created`, `corrected`
- `title`
- `detail`
- `actor_user_id`
- `occurred_at`
- `before_json` / `after_json` (valfritt, för teknisk diff)
- `organization_id` / `company_id` / `business_area_id` (för filtrering)

### Relationer
- Pekar på valfritt domänobjekt
- Utförd av **Användare** (systemactor tillåts)

### Behörighet
| Åtgärd | Roller |
| --- | --- |
| Skapa | Systemet (automatiskt); manuella anteckningar: AO-chef, Administratör |
| Läsa | Enligt läsrätt på underliggande objekt; VD/Ledningsgrupp brett |
| Ändra | **Ingen** — historik är append-only |

### Historik
Historikhändelser ändras inte; felaktiga poster kompenseras med ny korrigerande händelse.

---

## Sammanfattning: vad som alltid historikförs

| Objekt | Minst historikför |
| --- | --- |
| Organisation / Bolag | Namn, aktivering |
| Affärsområde | Status, ansvarig, nyckelmetadata |
| Användare / Roll | Aktivering, rolltilldelning |
| Mål / Aktivitet | Status, ansvarig, deadline/datum |
| KPI-definition | Definitionändringar |
| KPI-utfall | Skapande + korrigeringsversioner (aldrig tyst overwrite) |
| Beslut | Status och utfall |
| Rapport / Dokument | Publicering / ny version |
| Kommentar | Redigering och radering |

---

## Textbaserad relationsöversikt

```text
Organization (organizations)
 └── Company (companies)  [många bolag per organisation]
      └── BusinessArea (business_areas)  [många AO per bolag]
           ├── Goal (goals)  → User (owner)
           │    └── Activity (activities)  → User (owner)
           ├── Kpi (kpis)
           │    └── KpiResult (kpi_results)  [en rad per period (+ version vid korrigering)]
           ├── Decision (decisions)  → User (owner)
           │    └── Activity (activities)
           ├── Comment (comments)  [polymorf → goal/activity/area/decision/kpi_result]
           ├── Document (documents)  [polymorf]
           ├── Report (reports)  [kan även ligga på company/organization]
           └── HistoryEvent (history_events)  [polymorf, append-only]

User (users)
 ├── UserRole (user_roles) → Role (roles)
 │     scope: organization_id? / company_id? / business_area_id?
 └── (ägare/aktör för goals, activities, decisions, comments, documents, history)

Role (roles)
 └── Admin | CEO | Leadership | AreaManager | GoalOwner | Reader
```

### Kardinalitet (kort)

| Från | Till | Relation |
| --- | --- | --- |
| Organization | Company | 1:N |
| Company | BusinessArea | 1:N |
| BusinessArea | Goal | 1:N |
| BusinessArea | Kpi | 1:N |
| Kpi | KpiResult | 1:N |
| Goal | Activity | 1:N (valfri koppling) |
| User | UserRole | 1:N |
| Role | UserRole | 1:N |
| * | HistoryEvent | 1:N (append-only) |
| * | Comment / Document | 1:N (polymorf) |

---

## Implementationsstatus

| Lager | Status |
| --- | --- |
| Konceptuell modell (detta dokument) | Klar v0.1 |
| TypeScript-typer / mockdata i kod | Partiell (AO, mål, KPI, aktivitet, historik) |
| Fysisk databas | Ej påbörjad |
| API | Ej påbörjad |

---

*Uppdatera detta dokument när entiteter läggs till eller behörighetsregler skärps. Nästa steg kan vara att mappa befintlig mockdata mot denna modell inför databasval.*
