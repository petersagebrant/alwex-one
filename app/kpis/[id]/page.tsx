import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { KpiHistoryChart } from "@/components/kpis/KpiHistoryChart";
import { BeraknadTypeBadge } from "@/components/kpis/BeraknadTypeBadge";
import { SjukfranvaroAreasSection } from "@/components/kpis/SjukfranvaroAreasSection";
import { StatistikTypeBadge } from "@/components/kpis/StatistikTypeBadge";
import {
  InfoPanel,
  MetricCard,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import {
  formatExpectedFinalizationSv,
  formatMonthlyEconomicSummary,
  formatPeriodMonthSv,
  isMonthlyEconomicResultKpi,
} from "@/lib/kpi/economics";
import { buildMonthlyResultPresentation } from "@/lib/kpi/monthlyResultPresentation";
import {
  isCalculatedKpi,
  isNonTargetKpi,
  isStatisticKpi,
  isStatusTone,
  isSystemComputedKpi,
  isWeightedRatioPercentKpi,
} from "@/lib/kpi/kind";
import { resolveKpiTrend } from "@/lib/kpi/resolveTrend";
import { formatSjukfranvaroVdCompletenessLabel } from "@/lib/kpi/sjukfranvaroCompletenessLabel";
import { fetchBusinessAreaById } from "@/lib/supabase/business-areas";
import { getKPIById, isKpiArchived } from "@/services/kpis";
import { getKPIHistory } from "@/services/kpiHistory";
import { getSjukfranvaroComparison } from "@/services/sjukfranvaro";

type KpiVdDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const kpi = await getKPIById(id).catch(() => null);
  return {
    title: kpi
      ? `${kpi.name} | KPI | LEIR`
      : "KPI | LEIR",
    description: "KPI-detalj med historik",
  };
}

function formatValue(value: string | null, unit: string | null): string {
  if (!value) {
    return "—";
  }
  return unit ? `${value} ${unit}` : value;
}

/** Read-only VD KPI detail with history and chart. */
export default async function KpiVdDetailPage({
  params,
}: KpiVdDetailPageProps) {
  const { id } = await params;

  const kpi = await getKPIById(id).catch(() => null);
  if (!kpi) {
    notFound();
  }

  const archived = isKpiArchived(kpi);
  const showAoComparison = isWeightedRatioPercentKpi(kpi);
  const [history, area, sjukfranvaroComparison] = await Promise.all([
    getKPIHistory(kpi.id),
    fetchBusinessAreaById(kpi.businessAreaId).catch(() => null),
    showAoComparison
      ? getSjukfranvaroComparison({ companyKpiId: kpi.id })
      : Promise.resolve(null),
  ]);
  const historyNewestFirst = [...history].reverse();
  const isMonthlyEconomic = isMonthlyEconomicResultKpi(kpi);
  const isMonthlyStatistic =
    isStatisticKpi(kpi) && kpi.reportingFrequency === "MONTHLY";
  const monthlyPeriodMonth =
    (kpi.isPeriodPending ? kpi.expectedPeriodMonth : kpi.latestPeriodMonth) ??
    kpi.latestPeriodMonth ??
    kpi.expectedPeriodMonth;
  const monthlyPresentation =
    isMonthlyEconomic && monthlyPeriodMonth
      ? buildMonthlyResultPresentation({
          kpiName: kpi.name,
          unit: kpi.unit,
          periodLabel: formatPeriodMonthSv(monthlyPeriodMonth),
          isReported: !kpi.isPeriodPending,
          expectedFinalizationLabel: kpi.isPeriodPending
            ? `Förväntas omkring ${formatExpectedFinalizationSv(monthlyPeriodMonth)}`
            : null,
          actualValue: kpi.latestActualValue,
          budgetValue: kpi.latestBudgetValue,
          status: kpi.status,
        })
      : null;
  const displayTrend = resolveKpiTrend(kpi.trend, historyNewestFirst);
  const company = sjukfranvaroComparison?.company ?? null;
  const isPreliminary = Boolean(
    company &&
      formatSjukfranvaroVdCompletenessLabel({
        reportedAreas: company.reportedAreas,
        totalAreas: company.totalAreas,
        isComplete: company.isComplete,
      }),
  );

  const previousEntry = historyNewestFirst[1] ?? null;
  const latestEntry = historyNewestFirst[0] ?? null;

  const chartPoints = history.map((entry) => ({
    value: entry.value,
    status: entry.status,
    recordedAt: entry.recordedAt,
    label: entry.periodMonth
      ? formatPeriodMonthSv(entry.periodMonth, { includeYear: true })
      : formatDateSv(entry.recordedAt.slice(0, 10)),
  }));

  const areaHref = area ? `/areas/${area.slug}` : "/areas";

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#eef2f6] font-sans text-slate-800">
      <AppHeader current="home" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-800">
              Dashboard
            </Link>
            <span aria-hidden>/</span>
            <Link href="/areas" className="hover:text-slate-800">
              Affärsområden
            </Link>
            <span aria-hidden>/</span>
            <span className="text-slate-800">{kpi.name}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {kpi.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {kpi.businessAreaName}
                {kpi.category ? ` · ${kpi.category}` : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {archived ? (
                <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  Arkiverad
                </span>
              ) : null}
              {kpi.isPeriodPending ? (
                <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  Inväntar bokslut
                </span>
              ) : isStatisticKpi(kpi) ? (
                <StatistikTypeBadge />
              ) : isCalculatedKpi(kpi) ? (
                <BeraknadTypeBadge />
              ) : isStatusTone(kpi.status) ? (
                <StatusBadge status={kpi.status} />
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {monthlyPresentation ? (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
              <h2 className="text-base font-semibold text-slate-900">
                {monthlyPresentation.title}
              </h2>
              {monthlyPresentation.pendingLabel ? (
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Resultatmånad</dt>
                    <dd className="font-medium text-slate-800">{monthlyPresentation.resultMonth}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Status</dt>
                    <dd className="font-medium text-slate-800">{monthlyPresentation.pendingLabel}</dd>
                  </div>
                  {monthlyPresentation.expectedFinalizationLabel ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Förväntat bokslut</dt>
                      <dd className="font-medium text-slate-800">{monthlyPresentation.expectedFinalizationLabel}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <dl className="mt-4 space-y-2 text-sm tabular-nums">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Resultatmånad</dt><dd className="font-medium text-slate-800">{monthlyPresentation.resultMonth}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Faktiskt resultat</dt><dd className="font-medium text-slate-800">{monthlyPresentation.actualValue}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Budgeterat resultat</dt><dd className="font-medium text-slate-800">{monthlyPresentation.budgetValue}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Avvikelse</dt><dd className="font-medium text-slate-800">{monthlyPresentation.deviationValue}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd className="font-medium text-slate-800">{monthlyPresentation.statusValue}</dd></div>
                </dl>
              )}
            </section>
          ) : (
            <MetricCard
              name="Aktuellt värde"
              currentValue={isPreliminary ? (
                <span className="inline-flex items-baseline gap-2">
                  <span>{formatValue(kpi.currentValue, kpi.unit)}</span>
                  <span className="text-xs font-medium text-amber-700">
                    Preliminärt
                  </span>
                </span>
                ) : (
                  formatValue(kpi.currentValue, kpi.unit)
                )}
              targetValue={
                isStatisticKpi(kpi)
                  ? "Inget mål (statistik)"
                  : isCalculatedKpi(kpi)
                    ? "Inget mål (beräknad)"
                    : formatValue(kpi.targetValue, kpi.unit)
              }
              trend={displayTrend}
              status={
                !kpi.isPeriodPending && isStatusTone(kpi.status)
                  ? kpi.status
                  : undefined
              }
            />
          )}
          <InfoPanel
            title="Översikt"
            variant="info"
            showLabel={false}
            className="!border-slate-200/80 !bg-white"
            footer={
              <>
                Senast uppdaterad
                <span className="mt-0.5 block text-sm font-medium text-slate-800">
                  {formatDateTimeSv(kpi.updatedAt)}
                </span>
              </>
            }
          >
            <dl className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Affärsområde</dt>
                <dd className="font-medium text-slate-800">
                  {kpi.businessAreaName}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Typ</dt>
                <dd className="font-medium text-slate-800">
                  {isStatisticKpi(kpi)
                    ? "Statistik"
                    : isCalculatedKpi(kpi)
                      ? "Beräknad"
                      : isMonthlyEconomic
                        ? "Månadsresultat mot budget"
                        : "KPI med mål"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">
                  {isMonthlyEconomic ? "Föregående avvikelse" : "Föregående värde"}
                </dt>
                <dd className="font-medium text-slate-800">
                  {formatValue(previousEntry?.value ?? null, kpi.unit)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Senaste rapport</dt>
                <dd className="font-medium text-slate-800">
                  {latestEntry
                    ? formatDateTimeSv(latestEntry.recordedAt)
                    : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Trend</dt>
                <dd className="font-medium text-slate-800">{displayTrend}</dd>
              </div>
              {isSystemComputedKpi(kpi) ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">Beräkning</dt>
                  <dd className="font-medium text-slate-800">
                    Automatisk
                  </dd>
                </div>
              ) : null}
            </dl>
          </InfoPanel>
        </div>

        {sjukfranvaroComparison && sjukfranvaroComparison.areas.length > 0 ? (
          <SjukfranvaroAreasSection data={sjukfranvaroComparison} />
        ) : null}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6">
          <SectionHeader
            title="Värde över tid"
            description={
              isMonthlyStatistic
                ? "Månadsvis historik baserat på kpi_history"
                : isNonTargetKpi(kpi)
                ? "Historik baserat på kpi_history"
                : isMonthlyEconomic
                  ? "Månadsvis avvikelse mellan faktiskt och budgeterat resultat"
                : "Utfall och målvärde baserat på kpi_history"
            }
          />
          <div className="mt-4">
            {history.length === 0 ? (
              <InfoPanel title="Historik" variant="info" showLabel={false}>
                Inga historiska värden registrerade ännu.
              </InfoPanel>
            ) : (
              <KpiHistoryChart
                points={chartPoints}
                targetValue={
                  isNonTargetKpi(kpi) || isMonthlyEconomic
                    ? null
                    : kpi.targetValue
                }
                unit={kpi.unit}
                isStatistic={isNonTargetKpi(kpi) || isMonthlyEconomic}
              />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <SectionHeader
              title="Historik"
              description={`${history.length} registrerade värden`}
            />
          </div>

          {historyNewestFirst.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">
              Ingen historik registrerad ännu.
            </p>
          ) : (
            <div className="overflow-x-auto px-5 py-4">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="rounded-l-lg px-3 py-2.5 font-semibold">
                      {isMonthlyEconomic
                        ? "Resultatmånad"
                        : isMonthlyStatistic
                          ? "Månad"
                          : "Datum"}
                    </th>
                    <th className="px-3 py-2.5 font-semibold">
                      {isMonthlyEconomic ? "Resultat / Budget / Avvikelse" : "Värde"}
                    </th>
                    {isMonthlyEconomic ? (
                      <th className="px-3 py-2.5 font-semibold">Registrerad</th>
                    ) : null}
                    <th className="px-3 py-2.5 font-semibold">
                      {isNonTargetKpi(kpi) ? "Typ" : "Status"}
                    </th>
                    <th className="rounded-r-lg px-3 py-2.5 font-semibold">
                      Kommentar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyNewestFirst.map((entry) => (
                    <tr key={entry.id}>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                        {entry.periodMonth
                          ? formatPeriodMonthSv(entry.periodMonth, { includeYear: true })
                          : formatDateTimeSv(entry.recordedAt)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                        {isMonthlyEconomic
                          ? formatMonthlyEconomicSummary({
                              actualValue: entry.actualValue,
                              budgetValue: entry.budgetValue,
                              deviationValue: entry.value,
                              unit: kpi.unit,
                              status: entry.status,
                            })
                          : formatValue(entry.value, kpi.unit)}
                      </td>
                      {isMonthlyEconomic ? (
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                          {formatDateTimeSv(entry.recordedAt)}
                        </td>
                      ) : null}
                      <td className="border-b border-slate-100 px-3 py-3">
                        {isCalculatedKpi(kpi) ? (
                          <BeraknadTypeBadge />
                        ) : isStatisticKpi(kpi) ||
                          entry.status === "Statistik" ? (
                          <StatistikTypeBadge />
                        ) : isStatusTone(entry.status) ? (
                          <StatusBadge status={entry.status} />
                        ) : null}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                        {entry.comment || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href={areaHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            Tillbaka till affärsområde
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-[#0b1220] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Till dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
