# Changelog — Alwex One

Alla betydande ändringar i projektet dokumenteras här.  
Format inspirerat av [Keep a Changelog](https://keepachangelog.com/sv/1.1.0/).  
Versionsprincip: [Semantic Versioning](https://semver.org/lang/sv/) där det är praktiskt (`MAJOR.MINOR.PATCH`).

| Fält | Värde |
| --- | --- |
| Produkt | Alwex One |
| Dokument | `docs/Changelog.md` |
| Relaterat | `docs/SystemSpecification.md`, `docs/ProductBacklog.md` |
| Kodbas | `alwex-malportal` |

---

## [Unreleased]

### Planerat

- Separera mockdata och UI-komponenter
- Affärsområdessida med navigering från “Öppna målbild”
- Detaljering av systemspecifikationens kapitel

---

## [0.1.0] — 2026-08-04

### Tillagt

- Next.js 16-projekt med TypeScript och Tailwind CSS
- VD-dashboard (`app/page.tsx`) med:
  - mörk toppmeny (ALWEX Ledningsportal)
  - fyra nyckeltalskort
  - sex affärsområdeskort
  - sektioner för ledningens uppmärksamhet och kommande beslut
  - tabell för mål som kräver åtgärd
- Grundläggande dokumentation:
  - `docs/SystemSpecification.md` (Alwex One)
  - `docs/Ledningsportal-SystemSpecification.md` (MVP-detalj)
  - `docs/ProductBacklog.md`
  - `docs/Changelog.md`
- Git-repository med första commit: *Första versionen av Alwex Ledningsportal*

### Tekniskt

- Stack: Next.js 16.3, React 19, Tailwind CSS 4, npm
- App Router under `app/`
- Prototypdata hårdkodad i startsidan (ingen databas/API ännu)

---

## Versionsnyckel

| Version | Betydelse |
| --- | --- |
| 0.x | Tidig utveckling / prototyp |
| 1.0.0 | Första produktionsklara ledningsportalen |
| Unreleased | Ändringar som ännu inte versionerats |

---

*Vid varje release: flytta poster från Unreleased till en ny versionsrubrik med datum.*
