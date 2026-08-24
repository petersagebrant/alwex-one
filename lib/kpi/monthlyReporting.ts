import {
  formatPeriodMonthSv,
  buildMonthlyResultState,
} from "@/lib/kpi/economics";
import {
  hasValidKpiCurrentValue,
  isDailyManualReportableKpi,
  isManualReportableKpi,
  isMonthlyReportingKpi,
  isMonthlyStatisticKpi,
} from "@/lib/kpi/kind";
import type { DailyKpiReportItem, KPI, KPIHistory } from "@/types";

export function splitManualReportableKpis<
  T extends {
    kind: KPI["kind"];
    calcOperator?: KPI["calcOperator"];
    reportingFrequency?: KPI["reportingFrequency"] | null;
  },
>(kpis: T[]): { daily: T[]; monthly: T[] } {
  const reportable = kpis.filter(isManualReportableKpi);
  return {
    daily: reportable.filter(isDailyManualReportableKpi),
    monthly: reportable.filter(isMonthlyReportingKpi),
  };
}

export function monthlyStatisticPeriodLabel(periodMonth: string): string {
  return formatPeriodMonthSv(periodMonth, { includeYear: true });
}

export function isMonthlyStatisticReported(
  row: { value?: string | null } | null,
): boolean {
  return hasValidKpiCurrentValue(row?.value);
}

export function isMonthlyEconomicReported(
  row: {
    value?: string | null;
    actualValue?: string | null;
    budgetValue?: string | null;
  } | null,
): boolean {
  return (
    hasValidKpiCurrentValue(row?.value) &&
    hasValidKpiCurrentValue(row?.actualValue) &&
    hasValidKpiCurrentValue(row?.budgetValue)
  );
}

/**
 * MONTHLY KPIs are keyed by accounting period, not submission date.
 * STATISTIC: reported when `value` exists (no G/Y/R, no actual/budget).
 * TARGET: reported when actual + budget + deviation exist.
 */
export function toMonthlyReportItem(
  kpi: KPI,
  periodMonth: string,
  monthByKpi: Map<string, KPIHistory>,
  historyByKpi: Map<string, KPIHistory[]>,
): DailyKpiReportItem {
  const monthReport = monthByKpi.get(kpi.id) ?? null;
  const history = historyByKpi.get(kpi.id) ?? [];
  const previousEntry =
    history.find(
      (entry) => entry.periodMonth != null && entry.periodMonth !== periodMonth,
    ) ??
    history.find((entry) => entry.periodMonth == null) ??
    null;

  if (isMonthlyStatisticKpi(kpi)) {
    const isReported = isMonthlyStatisticReported(monthReport);
    const periodLabel = monthlyStatisticPeriodLabel(periodMonth);
    if (monthReport && isReported) {
      return {
        kpi,
        previousValue: previousEntry?.value ?? null,
        previousStatus: previousEntry?.status ?? null,
        todayReport: monthReport,
        isReported: true,
        periodMonth,
        periodLabel,
        pendingLabel: null,
        expectedFinalizationLabel: null,
        actualValue: null,
        budgetValue: null,
        deviationValue: monthReport.value,
        isLegacyDeviation: false,
      };
    }
    return {
      kpi,
      previousValue: kpi.currentValue ?? previousEntry?.value ?? null,
      previousStatus: kpi.status ?? previousEntry?.status ?? null,
      todayReport: null,
      isReported: false,
      periodMonth,
      periodLabel,
      pendingLabel: null,
      expectedFinalizationLabel: null,
      actualValue: null,
      budgetValue: null,
      deviationValue: monthReport?.value ?? null,
      isLegacyDeviation: false,
    };
  }

  const isReported = isMonthlyEconomicReported(monthReport);
  const periodLabel = formatPeriodMonthSv(periodMonth);

  if (monthReport && isReported) {
    return {
      kpi,
      previousValue: previousEntry?.value ?? null,
      previousStatus: previousEntry?.status ?? null,
      todayReport: monthReport,
      isReported: true,
      periodMonth,
      periodLabel,
      pendingLabel: null,
      expectedFinalizationLabel: null,
      actualValue: monthReport.actualValue,
      budgetValue: monthReport.budgetValue,
      deviationValue: monthReport.value,
      isLegacyDeviation: monthReport.isLegacyDeviation,
    };
  }

  const state = buildMonthlyResultState({
    latestFinalizedPeriodMonth: previousEntry?.periodMonth,
  });
  return {
    kpi,
    previousValue: kpi.currentValue ?? previousEntry?.value ?? null,
    previousStatus: kpi.status ?? previousEntry?.status ?? null,
    todayReport: null,
    isReported: false,
    periodMonth,
    periodLabel,
    pendingLabel: "Inväntar bokslut",
    expectedFinalizationLabel: `Förväntas omkring ${state.expectedFinalizationLabel}`,
    actualValue: monthReport?.actualValue ?? null,
    budgetValue: monthReport?.budgetValue ?? null,
    deviationValue: monthReport?.value ?? null,
    isLegacyDeviation: monthReport?.isLegacyDeviation ?? false,
  };
}

