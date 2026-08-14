import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { VdDiaryTimeline } from "@/components/dashboard/VdDiaryTimeline";
import { BeraknadTypeBadge } from "@/components/kpis/BeraknadTypeBadge";
import { StatistikTypeBadge } from "@/components/kpis/StatistikTypeBadge";
import {
  InfoPanel,
  SectionHeader,
  StatusBadge,
  SummaryCard,
} from "@/components/ui";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { isStatusTone } from "@/lib/kpi/kind";
import type { AoChefDashboardData } from "@/services/aoChefDashboard";

function yesterdayChangeDot(tone: string): string {
  if (tone === "red") return "bg-rose-500";
  if (tone === "yellow") return "bg-amber-400";
  if (tone === "green") return "bg-emerald-500";
  if (tone === "blue") return "bg-sky-500";
  return "bg-slate-400";
}

type AoChefDashboardProps = {
  data: AoChefDashboardData;
};

export function AoChefDashboard({ data }: AoChefDashboardProps) {
  const {
    area,
    greetingName,
    reporting,
    kpis,
    kpiCounts,
    goals,
    goalCounts,
    activities,
    activityCounts,
    decisions,
    yesterdayChanges,
    historyEvents,
  } = data;

  const overviewTitle = `${area.name.toUpperCase()} – ÖVERSIKT`;
  const greeting = greetingName
    ? `God morgon ${greetingName}.`
    : "God morgon.";
  const reportIncomplete =
    reporting.reportedCount < reporting.totalCount;
  const reportPct =
    reporting.totalCount > 0
      ? Math.round((reporting.reportedCount / reporting.totalCount) * 100)
      : 0;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#eef2f6] font-sans text-slate-800">
      <AppHeader current="home" />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500">
            {overviewTitle}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {greeting}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Här följer du upp KPI, mål och aktiviteter för {area.name}.
            {area.manager ? ` Ansvarig: ${area.manager}.` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-200/80">
              Status <StatusBadge status={area.status} />
            </span>
            <span className="rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-200/80">
              KPI {kpiCounts.green}G / {kpiCounts.yellow}Gul / {kpiCounts.red}R
            </span>
            <span className="rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-200/80">
              Mål {goalCounts.total}
            </span>
            <span className="rounded-md bg-slate-50 px-2 py-1 ring-1 ring-slate-200/80">
              Aktiviteter {activityCounts.total}
              {activityCounts.delayed > 0
                ? ` · ${activityCounts.delayed} försenade`
                : ""}
            </span>
          </div>
        </section>

        <InfoPanel
          title="Mina KPI:er idag"
          showLabel={false}
          compact
          className="!border-slate-200/80 !bg-white"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {reporting.reportedCount} av {reporting.totalCount}{" "}
                  rapporterade
                </p>
                <p className="text-sm text-slate-500">{area.name}</p>
              </div>
              <Link
                href="/report/kpis"
                className="inline-flex items-center rounded-xl bg-[#0b1220] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {reportIncomplete ? "Rapportera KPI" : "Visa rapporter"}
              </Link>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={reporting.reportedCount}
              aria-valuemin={0}
              aria-valuemax={reporting.totalCount}
              aria-label="Andel rapporterade KPI:er"
            >
              <div
                className="h-full rounded-full bg-slate-800 transition-[width] duration-300"
                style={{ width: `${reportPct}%` }}
              />
            </div>
          </div>
        </InfoPanel>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            title="Gröna KPI"
            value={String(kpiCounts.green)}
            status="Grön"
          />
          <SummaryCard
            title="Gula KPI"
            value={String(kpiCounts.yellow)}
            status="Gul"
          />
          <SummaryCard
            title="Röda KPI"
            value={String(kpiCounts.red)}
            status="Röd"
          />
          <SummaryCard
            title="Försenade"
            value={String(activityCounts.delayed)}
            status={activityCounts.delayed > 0 ? "Röd" : undefined}
            description={
              activityCounts.delayed > 0
                ? "Kräver uppmärksamhet"
                : undefined
            }
          />
        </section>

        <section className="space-y-3">
          <SectionHeader title="KPI:er" description={area.name} />
          {kpis.length === 0 ? (
            <p className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600">
              Inga KPI:er för {area.name}.
            </p>
          ) : (
            <ul className="space-y-2">
              {kpis.map((kpi) => (
                <li key={kpi.id}>
                  <Link
                    href={kpi.href}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {kpi.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {kpi.kind === "STATISTIC"
                          ? `${formatKpiDisplayValue(kpi.currentValue, kpi.unit)} · Typ: Statistik`
                          : kpi.kind === "CALCULATED"
                            ? `${formatKpiDisplayValue(kpi.currentValue, kpi.unit)} · Typ: Beräknad`
                            : kpi.calcOperator
                              ? `${formatKpiDisplayValue(kpi.currentValue, kpi.unit)} mot mål ${formatKpiDisplayValue(kpi.targetValue, kpi.unit)} · Beräknas automatiskt`
                              : `${formatKpiDisplayValue(kpi.currentValue, kpi.unit)} mot mål ${formatKpiDisplayValue(kpi.targetValue, kpi.unit)}`}
                      </p>
                    </div>
                    {kpi.kind === "STATISTIC" ? (
                      <StatistikTypeBadge />
                    ) : kpi.kind === "CALCULATED" ? (
                      <BeraknadTypeBadge />
                    ) : isStatusTone(kpi.status) ? (
                      <StatusBadge status={kpi.status} />
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeader title="Mål" />
          {goals.length === 0 ? (
            <p className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600">
              Inga mål registrerade.
            </p>
          ) : (
            <ul className="space-y-2">
              {goals.map((goal) => (
                <li key={goal.id}>
                  <Link
                    href={goal.href}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {goal.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {goal.owner}
                        {goal.deadline ? ` · Deadline ${goal.deadline}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={goal.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeader title="Aktiviteter" />
          {activities.length === 0 ? (
            <p className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600">
              Inga aktiviteter registrerade.
            </p>
          ) : (
            <ul className="space-y-2">
              {activities.map((activity) => (
                <li key={activity.id}>
                  <Link
                    href={activity.href}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {activity.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {activity.status}
                        {activity.isDelayed ? " · Försenad" : ""}
                        {activity.owner ? ` · ${activity.owner}` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeader title="Beslut / åtgärder" />
          {decisions.length === 0 ? (
            <p className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600">
              Inga öppna beslut för {area.name}.
            </p>
          ) : (
            <ul className="space-y-2">
              {decisions.map((decision) => (
                <li key={decision.id}>
                  <Link
                    href={decision.href}
                    className="block rounded-2xl border border-slate-200/80 bg-white px-4 py-3 transition hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {decision.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {decision.status}
                      {decision.dueDate ? ` · Förfaller ${decision.dueDate}` : ""}
                      {decision.owner ? ` · ${decision.owner}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <InfoPanel
          title="Vad har förändrats sedan igår?"
          variant="info"
          showLabel={false}
          compact
          className="!border-slate-200/80 !bg-white"
        >
          {yesterdayChanges.length === 0 ? (
            <p className="text-sm text-slate-600">
              Inga väsentliga förändringar för {area.name} sedan igår.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {yesterdayChanges.map((change) => (
                <li key={change.id} className="py-3 first:pt-0 last:pb-0">
                  {change.href ? (
                    <Link href={change.href} className="block hover:opacity-90">
                      <YesterdayRow change={change} />
                    </Link>
                  ) : (
                    <YesterdayRow change={change} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </InfoPanel>

        <section className="space-y-3">
          <SectionHeader
            title="Historik"
            description={`Endast ${area.name}`}
          />
          {historyEvents.length === 0 ? (
            <p className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm text-slate-600">
              Ingen historik ännu för {area.name}.
            </p>
          ) : (
            <VdDiaryTimeline events={historyEvents} />
          )}
        </section>
      </main>
    </div>
  );
}

function YesterdayRow({
  change,
}: {
  change: AoChefDashboardData["yesterdayChanges"][number];
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        aria-hidden
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${yesterdayChangeDot(
          change.tone,
        )}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">
          {change.detail || change.text}
        </p>
        {change.occurredAtLabel ? (
          <p className="mt-0.5 text-xs text-slate-500">
            {change.occurredAtLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
