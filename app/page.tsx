import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { getDashboardData } from "@/services/dashboard";
import { formatDateTimeSv } from "@/lib/format/date";
import type { StatusTone } from "@/types";

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

const kpiHref: Record<string, string> = {
  "business-areas": "/areas",
  goals: "/admin/goals",
  activities: "/admin/activities",
  "delayed-activities": "/admin/activities",
  "completed-goals": "/admin/goals",
  "ongoing-activities": "/admin/activities",
  "areas-with-red-goals": "/areas",
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

export default async function Home() {
  const {
    kpis,
    businessAreas,
    attentionItems,
    actionGoals,
    upcomingDecisions,
    recentEvents,
  } = await getDashboardData();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#eef2f6] font-sans text-slate-800">
      <AppHeader current="home" />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading" className="sr-only">
            Nyckeltal
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <Link
                key={kpi.id}
                href={kpiHref[kpi.id] ?? "/"}
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
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="areas-heading" className="space-y-4">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
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
              <Link
                href="/areas"
                className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
              >
                Visa alla
              </Link>
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {businessAreas.map((area) => (
              <li key={area.id}>
                <Link
                  href={`/areas/${area.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                >
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
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Mål</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {area.goalCount}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Aktiviteter</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {area.activityCount}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Försenade</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {area.delayedActivityCount}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 flex-1 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">
                    {area.comment}
                  </p>

                  <span className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#0b1220] px-4 py-2.5 text-sm font-semibold text-white transition duration-200 group-hover:bg-slate-800 group-active:scale-[0.99]">
                    Öppna målbild
                  </span>
                </Link>
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
            {attentionItems.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                Inga affärsområden kräver uppmärksamhet just nu.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {attentionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {item.detail}
                      </p>
                    </div>
                    <Link
                      href={`/areas/${item.slug}`}
                      className="shrink-0 text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                    >
                      Öppna
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Kommande beslut
            </h2>
            {upcomingDecisions.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                Inga beslutspunkter registrerade ännu.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {upcomingDecisions.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {item.detail}
                      </p>
                    </div>
                    <Link
                      href={`/admin/decisions?edit=${item.id}`}
                      className="shrink-0 text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                    >
                      Öppna
                    </Link>
                  </li>
                ))}
              </ul>
            )}
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
            {actionGoals.length === 0 ? (
              <p className="text-sm text-slate-600">
                Inga mål kräver åtgärd just nu.
              </p>
            ) : (
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="rounded-l-lg px-3 py-2.5 font-semibold">
                      Mål
                    </th>
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
            )}
          </div>
        </section>

        <section
          aria-labelledby="events-heading"
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6"
        >
          <h2
            id="events-heading"
            className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
          >
            Senaste händelser
          </h2>

          {recentEvents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              Inga händelser registrerade ännu.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500">
                      {formatDateTimeSv(event.createdAt)} · {event.actorName}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-800">
                      {event.description}
                    </p>
                  </div>
                  {event.href ? (
                    <Link
                      href={event.href}
                      className="shrink-0 text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                    >
                      Öppna
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
