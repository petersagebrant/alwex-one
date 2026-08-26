import Link from "next/link";
import { MonthlyEconomicPictureView } from "@/components/kpis/MonthlyEconomicPictureView";
import { BeraknadTypeBadge } from "@/components/kpis/BeraknadTypeBadge";
import { ReportingStatusBadge } from "@/components/kpis/ReportingStatusBadge";
import { StatusBadge } from "@/components/ui";
import { formatDateSv } from "@/lib/format/date";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import {
  isMonthlyEconomicResultKpi,
  isMonthlyRevenueVsBudgetKpi,
} from "@/lib/kpi/economics";
import {
  buildMonthlyEconomicPicture,
  isHiddenFromAreaKpiList,
} from "@/lib/kpi/monthlyResultPresentation";
import {
  isCalculatedKpi,
  isNonTargetKpi,
  isSystemComputedKpi,
} from "@/lib/kpi/kind";
import { resolveKpiStatusPresentation } from "@/lib/kpi/statusPresentation";
import type { KpiOverviewDisplayItem } from "@/services/kpiOverview";
import { getKPIHistory } from "@/services/kpiHistory";
import type { KPI, KpiTrend } from "@/types";

type AreaKpiListProps = {
  /** Prefer enriched rows (trend/previous/last report). Falls back to raw KPIs. */
  items?: KpiOverviewDisplayItem[];
  kpis?: KPI[];
};

function toDisplayItems(
  items: KpiOverviewDisplayItem[] | undefined,
  kpis: KPI[] | undefined,
): KpiOverviewDisplayItem[] {
  if (items && items.length > 0) {
    return items;
  }
  return (kpis ?? []).map((kpi) => ({
    kpi,
    displayTrend: kpi.trend as KpiTrend,
    previousValue: null,
    lastReportedAt: null,
    href: `/kpis/${kpi.id}`,
  }));
}

function AreaKpiStatusCell({ kpi }: { kpi: KPI }) {
  if (kpi.isPeriodPending) {
    return (
      <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
        Inväntar bokslut
      </span>
    );
  }
  const presentation = resolveKpiStatusPresentation(kpi);
  switch (presentation.kind) {
    case "rapporterad":
      return <ReportingStatusBadge reported />;
    case "ej_rapporterad":
      return <ReportingStatusBadge reported={false} />;
    case "beraknad":
      return <BeraknadTypeBadge />;
    case "tone":
      return <StatusBadge status={presentation.status} />;
    default:
      return null;
  }
}

export async function AreaKpiList({ items, kpis }: AreaKpiListProps) {
  const rows = toDisplayItems(items, kpis);
  const listRows = rows.filter((row) => !isHiddenFromAreaKpiList(row.kpi));
  const resultKpi =
    rows.find((row) => isMonthlyEconomicResultKpi(row.kpi))?.kpi ?? null;
  const revenueKpi =
    rows.find((row) => isMonthlyRevenueVsBudgetKpi(row.kpi))?.kpi ?? null;
  const [resultHistory, revenueHistory] = await Promise.all([
    resultKpi
      ? getKPIHistory(resultKpi.id).catch(() => [])
      : Promise.resolve([]),
    revenueKpi
      ? getKPIHistory(revenueKpi.id).catch(() => [])
      : Promise.resolve([]),
  ]);

  const picturePeriodMonth = resultKpi
    ? (resultKpi.isPeriodPending
        ? resultKpi.expectedPeriodMonth
        : resultKpi.latestPeriodMonth) ??
      resultKpi.latestPeriodMonth ??
      resultKpi.expectedPeriodMonth
    : null;
  const areaPicture =
    resultKpi && picturePeriodMonth
      ? buildMonthlyEconomicPicture({
          periodMonth: picturePeriodMonth,
          unit: resultKpi.unit,
          result: {
            actualValue: resultKpi.latestActualValue,
            budgetValue: resultKpi.latestBudgetValue,
            status: resultKpi.status,
            isReported: !resultKpi.isPeriodPending,
          },
          revenue:
            revenueKpi &&
            !revenueKpi.isPeriodPending &&
            revenueKpi.latestPeriodMonth === picturePeriodMonth
              ? {
                  actualValue: revenueKpi.latestActualValue,
                  budgetValue: revenueKpi.latestBudgetValue,
                  status: revenueKpi.status,
                  isReported: true,
                }
              : null,
          resultHistory: resultHistory.map((entry) => ({
            periodMonth: entry.periodMonth,
            actualValue: entry.actualValue,
            budgetValue: entry.budgetValue,
          })),
          revenueHistory: revenueHistory.map((entry) => ({
            periodMonth: entry.periodMonth,
            actualValue: entry.actualValue,
            budgetValue: entry.budgetValue,
          })),
          resultHref: `/kpis/${resultKpi.id}`,
        })
      : null;

  return (
    <div className="space-y-6">
      {areaPicture ? (
        <MonthlyEconomicPictureView picture={areaPicture} variant="ao" />
      ) : null}
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">KPI</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Alla aktiva nyckeltal för affärsområdet — klicka för historik
        </p>
      </div>

      {listRows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">
          Inga KPI registrerade ännu.
        </p>
      ) : (
        <div className="overflow-x-auto px-5 py-4">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="rounded-l-lg px-3 py-2.5 font-semibold">KPI</th>
                <th className="px-3 py-2.5 font-semibold">Utfall</th>
                <th className="px-3 py-2.5 font-semibold">Mål</th>
                <th className="px-3 py-2.5 font-semibold">Föregående</th>
                <th className="px-3 py-2.5 font-semibold">Trend</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="rounded-r-lg px-3 py-2.5 font-semibold">
                  Senaste rapport
                </th>
              </tr>
            </thead>
            <tbody>
              {listRows.map((row) => {
                const { kpi } = row;
                return (
                  <tr key={kpi.id} className="group">
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                      <Link href={row.href} className="hover:underline">
                        {kpi.name}
                        {isCalculatedKpi(kpi) ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">
                            Typ: Beräknad
                          </span>
                        ) : null}
                        {isSystemComputedKpi(kpi) && !isCalculatedKpi(kpi) ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">
                            Beräknas automatiskt
                          </span>
                        ) : null}
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      <Link
                        href={row.href}
                        className="block tabular-nums hover:text-slate-900"
                      >
                        {formatKpiDisplayValue(kpi.currentValue, kpi.unit)}
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      <Link
                        href={row.href}
                        className="block tabular-nums hover:text-slate-900"
                      >
                        {isNonTargetKpi(kpi)
                          ? "—"
                          : formatKpiDisplayValue(kpi.targetValue, kpi.unit)}
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      <Link
                        href={row.href}
                        className="block tabular-nums hover:text-slate-900"
                      >
                        {formatKpiDisplayValue(row.previousValue, kpi.unit)}
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                      <Link
                        href={row.href}
                        className="block hover:text-slate-900"
                      >
                        {row.displayTrend}
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <Link href={row.href} className="inline-flex">
                        <AreaKpiStatusCell kpi={kpi} />
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-600">
                      <Link
                        href={row.href}
                        className="block hover:text-slate-900"
                      >
                        {row.lastReportedAt
                          ? formatDateSv(row.lastReportedAt.slice(0, 10))
                          : "—"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </div>
  );
}
