import type { BusinessArea } from "@/types";

export const businessAreas: BusinessArea[] = [
  {
    slug: "kyl-frys",
    name: "Kyl & Frys",
    description:
      "Temperaturkontrollerad logistik och distribution för livsmedel och andra kylkrävande flöden. Fokus på leveranskvalitet, kapacitetsutnyttjande och lönsamhet.",
    manager: "Lars-Olof Larsson",
    status: "Grön",
    updatedAt: "2026-08-03",
  },
  {
    slug: "lager-logistik",
    name: "Lager & Logistik",
    description:
      "Lagertjänster, plock, pack och distributionslösningar. Affärsområdet följs extra noga med anledning av negativt resultat och bemanningsfrågor.",
    manager: "Carl Backler",
    status: "Röd",
    updatedAt: "2026-08-04",
  },
  {
    slug: "fjarr-miljo",
    name: "Fjärr & Miljö",
    description:
      "Fjärrtransporter och miljörelaterade uppdrag. Prioritet på nya kundstarter, volymstabilitet och budgetföljsamhet.",
    manager: "Charlotte Häggblad",
    status: "Gul",
    updatedAt: "2026-08-02",
  },
  {
    slug: "mark-anlaggning",
    name: "Mark & Anläggning",
    description:
      "Markarbeten och anläggningstjänster. Avvikelser mot budget hanteras via aktiva åtgärder och tätare uppföljning.",
    manager: "Glenn Petersson",
    status: "Gul",
    updatedAt: "2026-08-01",
  },
  {
    slug: "recycling",
    name: "Recycling",
    description:
      "Återvinning och materialflöden. Marknaden är fortsatt svag med vikande volymer, vilket kräver ledningsfokus och investeringsbeslut.",
    manager: "Sven-Göran Rohlin",
    status: "Röd",
    updatedAt: "2026-08-04",
  },
  {
    slug: "intermodal",
    name: "Intermodal",
    description:
      "Kombinerade transporter med fokus på effektivitet, hållbarhet och stabil leveranskvalitet i det intermodala nätverket.",
    manager: "Alwex Intermodal",
    status: "Grön",
    updatedAt: "2026-07-30",
  },
  {
    slug: "fastighet",
    name: "Fastighet",
    description:
      "Förvaltning och utveckling av Alwex fastighetsbestånd. Fokus på beläggning, underhållsplan och kostnadskontroll.",
    manager: "Maria Blomqvist",
    status: "Grön",
    updatedAt: "2026-08-02",
  },
];
