import type { HistoryEvent } from "@/types";

export const historyEvents: HistoryEvent[] = [
  {
    id: "h-kf-1",
    areaSlug: "kyl-frys",
    date: "2026-08-03",
    title: "Status uppdaterad till Grön",
    detail: "Leveransprecision och resultat inom mål.",
  },
  {
    id: "h-ll-1",
    areaSlug: "lager-logistik",
    date: "2026-08-04",
    title: "Ledningsflagga aktiverad",
    detail: "Fortsatt negativt resultat kräver uppföljning.",
  },
  {
    id: "h-ll-2",
    areaSlug: "lager-logistik",
    date: "2026-07-28",
    title: "Ny åtgärd tillagd",
    detail: "Bemanningsalternativ ska tas fram till augusti.",
  },
  {
    id: "h-fm-1",
    areaSlug: "fjarr-miljo",
    date: "2026-08-02",
    title: "Kundstart försenad",
    detail: "En av fyra starter flyttad till nästa period.",
  },
  {
    id: "h-ma-1",
    areaSlug: "mark-anlaggning",
    date: "2026-08-01",
    title: "Budgetavvikelse noterad",
    detail: "Avvikelse mot budget markerad som Gul.",
  },
  {
    id: "h-re-1",
    areaSlug: "recycling",
    date: "2026-08-04",
    title: "Volymvarning",
    detail: "Vikande volymer och svag marknad.",
  },
  {
    id: "h-im-1",
    areaSlug: "intermodal",
    date: "2026-07-30",
    title: "Kvartalsuppföljning klar",
    detail: "Stabil trend och godkänd leveranskvalitet.",
  },
  {
    id: "h-fa-1",
    areaSlug: "fastighet",
    date: "2026-08-02",
    title: "Underhållsplan godkänd",
    detail: "Höstens planerade underhåll fastställd.",
  },
];
