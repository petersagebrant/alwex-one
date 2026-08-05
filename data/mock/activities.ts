type MockActivity = {
  id: string;
  areaSlug: string;
  title: string;
  owner: string;
  dueDate: string;
  status: "Öppen" | "Pågår" | "Klar";
  priority: "Grön" | "Gul" | "Röd";
};

export const activities: MockActivity[] = [
  {
    id: "a-kf-1",
    areaSlug: "kyl-frys",
    title: "Uppföljning av returflöden Q3",
    owner: "Lars-Olof Larsson",
    dueDate: "2026-08-18",
    status: "Pågår",
    priority: "Gul",
  },
  {
    id: "a-ll-1",
    areaSlug: "lager-logistik",
    title: "Ta fram bemanningsalternativ",
    owner: "Carl Backler",
    dueDate: "2026-08-10",
    status: "Pågår",
    priority: "Röd",
  },
  {
    id: "a-ll-2",
    areaSlug: "lager-logistik",
    title: "Veckomöte resultatåtgärder",
    owner: "Carl Backler",
    dueDate: "2026-08-08",
    status: "Öppen",
    priority: "Röd",
  },
  {
    id: "a-ll-3",
    areaSlug: "lager-logistik",
    title: "Analys av övertid per skift",
    owner: "Controller",
    dueDate: "2026-08-15",
    status: "Pågår",
    priority: "Gul",
  },
  {
    id: "a-fm-1",
    areaSlug: "fjarr-miljo",
    title: "Avstämning nya kundstarter",
    owner: "Charlotte Häggblad",
    dueDate: "2026-08-09",
    status: "Pågår",
    priority: "Gul",
  },
  {
    id: "a-ma-1",
    areaSlug: "mark-anlaggning",
    title: "Budgetavstämning pågående projekt",
    owner: "Glenn Petersson",
    dueDate: "2026-08-12",
    status: "Öppen",
    priority: "Gul",
  },
  {
    id: "a-re-1",
    areaSlug: "recycling",
    title: "Marknadsanalys volymnedgång",
    owner: "Sven-Göran Rohlin",
    dueDate: "2026-08-14",
    status: "Pågår",
    priority: "Röd",
  },
  {
    id: "a-re-2",
    areaSlug: "recycling",
    title: "Förbereda investeringsunderlag",
    owner: "Sven-Göran Rohlin",
    dueDate: "2026-08-22",
    status: "Öppen",
    priority: "Röd",
  },
  {
    id: "a-im-1",
    areaSlug: "intermodal",
    title: "Kvalitetsuppföljning terminalflöden",
    owner: "Alwex Intermodal",
    dueDate: "2026-08-20",
    status: "Klar",
    priority: "Grön",
  },
  {
    id: "a-fa-1",
    areaSlug: "fastighet",
    title: "Planera höstens underhållsstopp",
    owner: "Maria Blomqvist",
    dueDate: "2026-08-28",
    status: "Öppen",
    priority: "Grön",
  },
  {
    id: "a-fa-2",
    areaSlug: "fastighet",
    title: "Uppföljning vakanser",
    owner: "Maria Blomqvist",
    dueDate: "2026-08-16",
    status: "Pågår",
    priority: "Gul",
  },
];
