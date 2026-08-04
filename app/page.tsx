type StatusTone = "Grön" | "Gul" | "Röd";

type KpiCard = {
  id: string;
  label: string;
  value: string;
  status: StatusTone;
};

type BusinessArea = {
  id: string;
  name: string;
  manager: string;
  status: StatusTone;
  comment: string;
};

type AttentionItem = {
  id: string;
  title: string;
  detail: string;
};

type DecisionItem = {
  id: string;
  text: string;
};

type ActionGoal = {
  id: string;
  goal: string;
  area: string;
  owner: string;
  deadline: string;
  status: StatusTone;
};

const kpis: KpiCard[] = [
  {
    id: "resultat",
    label: "Resultat mot budget",
    value: "+1,8 Mkr",
    status: "Grön",
  },
  {
    id: "omsattning",
    label: "Omsättning mot budget",
    value: "98 %",
    status: "Gul",
  },
  {
    id: "leverans",
    label: "Leveransprecision",
    value: "99,3 %",
    status: "Grön",
  },
  {
    id: "prognos",
    label: "Prognos helår",
    value: "+8,0 Mkr",
    status: "Grön",
  },
];

const businessAreas: BusinessArea[] = [
  {
    id: "kyl-frys",
    name: "Kyl & Frys",
    manager: "Lars-Olof Larsson",
    status: "Grön",
    comment: "Stabil utveckling och god måluppfyllelse.",
  },
  {
    id: "lager-logistik",
    name: "Lager & Logistik",
    manager: "Carl Backler",
    status: "Röd",
    comment: "Negativt resultat kräver aktiv ledningsuppföljning.",
  },
  {
    id: "fjarr-miljo",
    name: "Fjärr & Miljö",
    manager: "Charlotte Häggblad",
    status: "Gul",
    comment: "Nära budget men med vissa volymavvikelser.",
  },
  {
    id: "mark-anlaggning",
    name: "Mark & Anläggning",
    manager: "Glenn Petersson",
    status: "Gul",
    comment: "Avvikelse mot budget, åtgärder pågår.",
  },
  {
    id: "recycling",
    name: "Recycling",
    manager: "Sven-Göran Rohlin",
    status: "Röd",
    comment: "Vikande volymer och fortsatt svag marknad.",
  },
  {
    id: "intermodal",
    name: "Intermodal",
    manager: "Alwex Intermodal",
    status: "Grön",
    comment: "Positiv trend och stabil leveranskvalitet.",
  },
];

const attentionItems: AttentionItem[] = [
  {
    id: "att-1",
    title: "Lager & Logistik",
    detail: "Fortsatt negativt resultat",
  },
  {
    id: "att-2",
    title: "Recycling",
    detail: "Vikande volymer och svag marknad",
  },
  {
    id: "att-3",
    title: "Mark & Anläggning",
    detail: "Avvikelse mot budget",
  },
];

const upcomingDecisions: DecisionItem[] = [
  {
    id: "dec-1",
    text: "Beslut om bemanning inom Lager & Logistik",
  },
  {
    id: "dec-2",
    text: "Investeringsbeslut Recycling",
  },
  {
    id: "dec-3",
    text: "Uppföljning av nya kundstarter",
  },
];

const actionGoals: ActionGoal[] = [
  {
    id: "goal-1",
    goal: "Återställa positivt resultat",
    area: "Lager & Logistik",
    owner: "Carl Backler",
    deadline: "2026-08-31",
    status: "Röd",
  },
  {
    id: "goal-2",
    goal: "Stabilisera volymutveckling",
    area: "Recycling",
    owner: "Sven-Göran Rohlin",
    deadline: "2026-09-15",
    status: "Röd",
  },
  {
    id: "goal-3",
    goal: "Minska budgetavvikelse",
    area: "Mark & Anläggning",
    owner: "Glenn Petersson",
    deadline: "2026-08-20",
    status: "Gul",
  },
  {
    id: "goal-4",
    goal: "Säkra ny kundstart enligt plan",
    area: "Fjärr & Miljö",
    owner: "Charlotte Häggblad",
    deadline: "2026-08-12",
    status: "Gul",
  },
];

const statusDot: Record<StatusTone, string> = {
  Grön: "bg-emerald-500",
  Gul: "bg-amber-400",
  Röd: "bg-rose-500",
};

const statusBadge: Record<StatusTone, string> = {
  Grön: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  Gul: "bg-amber-50 text-amber-900 ring-amber-200/80",
  Röd: "bg-rose-50 text-rose-800 ring-rose-200/80",
};

function StatusPill({ status }: { status: StatusTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadge[status]}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[status]}`}
      />
      {status}
    </span>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#eef2f6] font-sans text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-900/30 bg-[#0b1220] text-white shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-0 lg:h-16">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-[0.12em] text-white uppercase sm:text-[15px]">
              ALWEX Ledningsportal
            </p>
            <p className="mt-0.5 text-xs text-slate-300 sm:text-sm">
              Målbild och verksamhetsuppföljning
            </p>
          </div>

          <div className="inline-flex max-w-full items-center gap-3 self-start rounded-xl border border-white/10 bg-white/5 px-3 py-2 lg:self-auto">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-xs font-semibold text-sky-200"
            >
              PS
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                Peter Sagebrant, VD
              </p>
              <p className="text-[11px] text-slate-400">Inloggad</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" className="sr-only">
            Nyckeltal
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <article
                key={kpi.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-500">
                    {kpi.label}
                  </p>
                  <StatusPill status={kpi.status} />
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.7rem]">
                  {kpi.value}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="areas-heading" className="space-y-4">
          <div>
            <h2
              id="areas-heading"
              className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl"
            >
              Affärsområden
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Status, ansvar och målbild per affärsområde.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {businessAreas.map((area) => (
              <li key={area.id}>
                <article className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                      {area.name}
                    </h3>
                    <StatusPill status={area.status} />
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Ansvarig</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {area.manager}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 flex-1 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">
                    {area.comment}
                  </p>

                  <button
                    type="button"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#0b1220] px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 active:scale-[0.99]"
                  >
                    Öppna målbild
                  </button>
                </article>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-label="Ledningsfokus"
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Kräver ledningens uppmärksamhet
            </h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {attentionItems.map((item) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    aria-hidden
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Kommande beslut
            </h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {upcomingDecisions.map((item, index) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600"
                  >
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium leading-relaxed text-slate-800 sm:text-[15px]">
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section
          aria-labelledby="actions-heading"
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6"
        >
          <h2
            id="actions-heading"
            className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
          >
            Mål som kräver åtgärd
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="rounded-l-lg px-3 py-2.5 font-semibold">Mål</th>
                  <th className="px-3 py-2.5 font-semibold">Affärsområde</th>
                  <th className="px-3 py-2.5 font-semibold">Ansvarig</th>
                  <th className="px-3 py-2.5 font-semibold">Deadline</th>
                  <th className="rounded-r-lg px-3 py-2.5 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {actionGoals.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      {row.goal}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.area}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.owner}
                    </td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 text-slate-700">
                      {row.deadline}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <StatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
