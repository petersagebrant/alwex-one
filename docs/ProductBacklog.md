# Produktbacklog — Alwex One

| Fält | Värde |
| --- | --- |
| Produkt | Alwex One |
| Dokument | `docs/ProductBacklog.md` |
| Relaterat | `docs/SystemSpecification.md`, `docs/Changelog.md` |
| Status | Levande backlog |
| Senast uppdaterad | 2026-08-04 |

Prioritering: **Must** → måste med i närmaste leverans · **Should** → viktigt snart · **Could** → önskvärt senare · **Won’t** → medvetet utanför just nu.

---

## Klart

| ID | Post | Kommentar |
| --- | --- | --- |
| PB-001 | Next.js-projekt uppsatt | `alwex-malportal`, TypeScript, Tailwind |
| PB-002 | VD-dashboard (prototyp) | KPI, affärsområden, ledningslistor, åtgärdstabell |
| PB-003 | Systemspecifikation | Grunddokument för Alwex One |
| PB-004 | Git-repo initierat | Första commit av ledningsportal |

---

## Must — nästa sprint / fas 1

| ID | Post | Beskrivning | Beror på |
| --- | --- | --- | --- |
| PB-010 | Separera data från UI | Flytta typer och mockdata ur `app/page.tsx` | — |
| PB-011 | Återanvändbara komponenter | Header, KpiCard, AreaCard, StatusPill, ActionTable | PB-010 |
| PB-012 | Affärsområdessida | Route `/areas/[id]` med målbild per AO | PB-010 |
| PB-013 | Koppla “Öppna målbild” | Navigering från dashboard till AO-sida | PB-012 |
| PB-014 | Detaljera systemspec | Fylla kapitlen vision–säkerhet stegvis | — |

---

## Should — fas 2

| ID | Post | Beskrivning |
| --- | --- | --- |
| PB-020 | Domänmodell | Canonical modell för AO, mål, aktiviteter, KPI |
| PB-021 | Datakälla | JSON/DB i stället för hårdkodad JSX-data |
| PB-022 | Målstyrning (CRUD) | Skapa/uppdatera mål, status, deadline |
| PB-023 | Aktiviteter | Tilldela, följa upp och stänga åtgärder |
| PB-024 | Filter i åtgärdstabell | Filtrera på AO, status, ansvarig, deadline |
| PB-025 | Användarroller (modell) | VD, AO-chef, controller, ledningsstöd |

---

## Could — fas 3–4

| ID | Post | Beskrivning |
| --- | --- | --- |
| PB-030 | Rapporter | Ledningsunderlag i portal + export PDF/Excel |
| PB-031 | KPI-historik | Periodval och jämförelse över tid |
| PB-032 | AI-sammanfattning | Avvikelser, åtgärdsförslag, mötesunderlag |
| PB-033 | Autentisering | T.ex. Microsoft Entra ID |
| PB-034 | Rollbaserad behörighet | Styr vyer och skrivrättigheter |
| PB-035 | API-lager | Stabilt kontrakt för UI och integrationer |
| PB-036 | Integration ekonomi/BI | Automatiserade nyckeltal |

---

## Won’t (just nu)

| ID | Post | Motivering |
| --- | --- | --- |
| PB-090 | Native mobilapp | Webb först, responsiv design räcker |
| PB-091 | Full ERP-ersättning | Portalen kompletterar, ersätter inte källsystem |

---

## Prioriterad kö (arbetslista)

1. PB-010 Separera data från UI  
2. PB-011 Återanvändbara komponenter  
3. PB-012 Affärsområdessida  
4. PB-013 Koppla “Öppna målbild”  
5. PB-014 Detaljera systemspec  
6. PB-020 Domänmodell  
7. PB-021 Datakälla  

---

*Uppdatera backlogen när poster startas, slutförs eller omprioriteras. Nya ID:n följer serien PB-xxx.*
