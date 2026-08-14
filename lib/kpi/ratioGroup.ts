import type { KpiCalcOperator, KpiKind } from "@/lib/kpi/kind";

/** Calc-linked RATIO_PERCENT TARGET + its two STATISTIC inputs. */
export type RatioPercentGroupIds = {
  resultKpiId: string;
  numeratorKpiId: string;
  denominatorKpiId: string;
};

type GroupableKpi = {
  id: string;
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
  calcNumeratorKpiId?: string | null;
  calcDenominatorKpiId?: string | null;
};

/**
 * Find TARGET KPIs with RATIO_PERCENT whose numerator/denominator FKs
 * point at STATISTIC KPIs in the same set (e.g. Sjukfrånvaro + hours).
 * Relation-based — not name-hardcoded.
 */
export function findRatioPercentGroups(
  kpis: GroupableKpi[],
): RatioPercentGroupIds[] {
  const byId = new Map(kpis.map((kpi) => [kpi.id, kpi]));
  const groups: RatioPercentGroupIds[] = [];

  for (const kpi of kpis) {
    if (kpi.kind !== "TARGET" || kpi.calcOperator !== "RATIO_PERCENT") {
      continue;
    }
    const numeratorId = kpi.calcNumeratorKpiId;
    const denominatorId = kpi.calcDenominatorKpiId;
    if (!numeratorId || !denominatorId || numeratorId === denominatorId) {
      continue;
    }

    const numerator = byId.get(numeratorId);
    const denominator = byId.get(denominatorId);
    if (!numerator || !denominator) {
      continue;
    }
    if (numerator.kind !== "STATISTIC" || denominator.kind !== "STATISTIC") {
      continue;
    }

    groups.push({
      resultKpiId: kpi.id,
      numeratorKpiId: numeratorId,
      denominatorKpiId: denominatorId,
    });
  }

  return groups;
}

/** All KPI ids that belong to any ratio group (result + both inputs). */
export function collectRatioGroupMemberIds(
  groups: RatioPercentGroupIds[],
): Set<string> {
  const ids = new Set<string>();
  for (const group of groups) {
    ids.add(group.resultKpiId);
    ids.add(group.numeratorKpiId);
    ids.add(group.denominatorKpiId);
  }
  return ids;
}

type ReportedFlag = { isReported: boolean };

/**
 * User-facing daily reporting progress: each RATIO_PERCENT block counts as
 * one point (complete when both STATISTIC inputs are reported). Standalone
 * manual items count one each. Separate CALCULATED rows (e.g. DIVIDE) are
 * not passed in and must not be counted.
 */
export function countDailyReportingProgress(input: {
  items: ReportedFlag[];
  ratioGroups: { numerator: ReportedFlag; denominator: ReportedFlag }[];
}): { reportedCount: number; totalCount: number } {
  const groupReported = input.ratioGroups.filter(
    (group) => group.numerator.isReported && group.denominator.isReported,
  ).length;
  const itemReported = input.items.filter((item) => item.isReported).length;

  return {
    reportedCount: groupReported + itemReported,
    totalCount: input.ratioGroups.length + input.items.length,
  };
}
