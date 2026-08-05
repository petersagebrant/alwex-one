# Systemspecifikation — Alwex One

| Fält | Värde |
| --- | --- |
| Produkt | Alwex One |
| Dokument | `docs/SystemSpecification.md` |
| Språk | Svenska |
| Status | Grunddokument för utveckling |
| Version | 0.1 |
| Senast uppdaterad | 2026-08-04 |

---

## Innehållsförteckning

1. [Vision](#1-vision)
2. [Mål](#2-mål)
3. [Användarroller](#3-användarroller)
4. [Dashboard](#4-dashboard)
5. [Affärsområden](#5-affärsområden)
6. [Målstyrning](#6-målstyrning)
7. [Aktiviteter](#7-aktiviteter)
8. [Nyckeltal](#8-nyckeltal)
9. [AI-funktioner](#9-ai-funktioner)
10. [Rapporter](#10-rapporter)
11. [Databas](#11-databas)
12. [API](#12-api)
13. [Säkerhet](#13-säkerhet)
14. [Framtida integrationer](#14-framtida-integrationer)

---

## 1. Vision

Alwex One ska vara koncernens gemensamma digitala plattform för ledning, målstyrning och verksamhetsuppföljning. Plattformen samlar status, ansvar och beslut i en tydlig helhet så att ledningen kan styra Alwex baserat på aktuell och gemensam information.

---

## 2. Mål

Ge VD och ledning en snabb överblick över koncernens resultat, avvikelser och prioriteringar. Stödja affärsområdeschefer i uppföljning av målbilder och åtgärder. Skapa en skalbar grund för data, processer och framtida integrationer utan att tappa enkelhet i det dagliga arbetet.

---

## 3. Användarroller

Definiera vilka som använder Alwex One och vad de får se respektive göra. Centrala roller är VD, affärsområdeschef, controller/ekonomi och ledningsstöd. Rollerna styr behörighet, vyer och ansvar i systemet.

---

## 4. Dashboard

Startsida för ledningen med koncernöversikt: nyckeltal, status per affärsområde, frågor som kräver uppmärksamhet och kommande beslut. Dashboarden ska vara responsiv, snabb att tolka och fungera som nav till fördjupning.

---

## 5. Affärsområden

Hantera Alwex affärsområden som egna uppföljningsenheter, till exempel Kyl & Frys, Lager & Logistik, Fjärr & Miljö, Mark & Anläggning, Recycling och Intermodal. Varje område har ansvarig, status, kommentar och koppling till mål och aktiviteter.

---

## 6. Målstyrning

Stöd för att formulera, äga och följa upp målbilder på koncern- och affärsområdesnivå. Mål ska ha ansvarig, deadline, status och tydlig koppling till åtgärder när utfallet avviker från plan.

---

## 7. Aktiviteter

Aktiviteter är konkreta åtgärder kopplade till mål, avvikelser eller beslut. De ska kunna planeras, tilldelas, följas upp och stängas så att ledningen ser vad som görs och vad som återstår.

---

## 8. Nyckeltal

Definiera och visa de KPI:er som styr verksamheten, exempelvis resultat mot budget, omsättning, leveransprecision och prognos. Nyckeltal ska ha period, enhet, status och möjlighet till jämförelse över tid.

---

## 9. AI-funktioner

Använd AI som stöd för sammanfattningar, avvikelseförklaringar, förslag på åtgärder och underlag till ledningsmöten. AI ska förstärka beslutsunderlag, inte ersätta ansvariga chefers bedömning.

---

## 10. Rapporter

Skapa standardiserade underlag för ledningsmöten, perioduppföljning och status per affärsområde. Rapporter ska kunna visas i portalen och exporteras vid behov, till exempel till PDF eller Excel.

---

## 11. Databas

Lagra affärsområden, användare, mål, aktiviteter, nyckeltal, statushistorik och beslutspunkter på ett strukturerat sätt. Datamodellen ska vara tydlig, spårbar och förberedd för tillväxt och integrationer.

---

## 12. API

Exponera och konsumera data via ett stabilt API-lager mellan gränssnitt, tjänster och externa system. API:et ska stödja autentisering, versionshantering och tydliga kontrakt för läsning och uppdatering av domänobjekt.

---

## 13. Säkerhet

Skydda företagsintern information genom autentisering, rollbaserad behörighet, loggning och säker hantering av data. Säkerhetskrav ska gälla både applikation, API och lagring.

---

## 14. Framtida integrationer

Förbereda kopplingar mot ekonomi-, BI- och övriga verksamhetssystem för automatiserade nyckeltal och minskad manuell uppdatering. Integrationer införs stegvis där affärsnytta och datakvalitet är säkerställda.

---

*Detta dokument är en levande grundspecifikation för Alwex One och ska detaljeras kapitel för kapitel under utvecklingen.*
