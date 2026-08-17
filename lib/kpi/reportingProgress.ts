import {
  isDailyManualReportableKpi,
  type KpiCalcOperator,
  type KpiKind,
  type KpiReportingFrequency,
} from "@/lib/kpi/kind";
import {
  collectRatioGroupMemberIds,
  countDailyReportingProgress,
  findRatioPercentGroups,
} from "@/lib/kpi/ratioGroup";

export type ReportingProgressKpi = {
  id: string;
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
  calcNumeratorKpiId?: string | null;
  calcDenominatorKpiId?: string | null;
  reportingFrequency?: KpiReportingFrequency | null;
};

/**
 * Daily reporting progress for a KPI set (typically one business area).
 * Manual daily reportable points only; each RATIO_PERCENT group counts as one.
 * MONTHLY KPIs (e.g. Resultat mot budget) are excluded.
 */
export function countKpiSetReportingProgress(
  kpis: ReportingProgressKpi[],
  reportedIds: ReadonlySet<string>,
): { reportedCount: number; totalCount: number } {
  const reportable = kpis.filter(isDailyManualReportableKpi);
  const groups = findRatioPercentGroups(kpis);
  const groupedIds = collectRatioGroupMemberIds(groups);

  const standalone = reportable.filter((kpi) => !groupedIds.has(kpi.id));

  return countDailyReportingProgress({
    items: standalone.map((kpi) => ({
      isReported: reportedIds.has(kpi.id),
    })),
    ratioGroups: groups.map((group) => ({
      numerator: { isReported: reportedIds.has(group.numeratorKpiId) },
      denominator: { isReported: reportedIds.has(group.denominatorKpiId) },
    })),
  });
}
