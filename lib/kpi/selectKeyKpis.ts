import {
  hasValidKpiCurrentValue,
  isStatusTone,
  isTargetKpi,
  type KpiKind,
  type KpiStoredStatus,
} from "@/lib/kpi/kind";
import { isMonthlyRevenueVsBudgetKpi } from "@/lib/kpi/economics";
import { targetDeviationMagnitude } from "@/lib/kpi/targetDeviation";

const DEFAULT_KEY_KPI_LIMIT = 4;

const STATUS_RANK: Record<"Röd" | "Gul" | "Grön", number> = {
  Röd: 0,
  Gul: 1,
  Grön: 2,
};

export type KeyKpiCandidate = {
  id: string;
  kind: KpiKind;
  status: KpiStoredStatus;
  currentValue?: string | null;
  targetValue?: string | null;
  name?: string | null;
};

/**
 * Select key KPIs for area overview cards.
 *
 * Rules (v1):
 * - Max `limit` (default 4)
 * - TARGET only (incl. RATIO_PERCENT) — STATISTIC / CALCULATED excluded
 * - Omsättning mot budget excluded (economic sibling of Resultat mot budget)
 * - Requires a valid numeric current value (no key slot for "Ej rapporterad")
 * - Status order: Röd → Gul → Grön
 * - Same status → largest deviation from target
 */
export function selectKeyKpis<T extends KeyKpiCandidate>(
  kpis: T[],
  limit: number = DEFAULT_KEY_KPI_LIMIT,
): T[] {
  if (limit <= 0) {
    return [];
  }

  const targets = kpis.filter(
    (kpi) =>
      isTargetKpi(kpi) &&
      !isMonthlyRevenueVsBudgetKpi(kpi) &&
      isStatusTone(kpi.status) &&
      hasValidKpiCurrentValue(kpi.currentValue),
  );

  const ranked = [...targets].sort((a, b) => {
    const statusA = a.status as "Röd" | "Gul" | "Grön";
    const statusB = b.status as "Röd" | "Gul" | "Grön";
    const rankDiff = STATUS_RANK[statusA] - STATUS_RANK[statusB];
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const deviationDiff =
      targetDeviationMagnitude(b.currentValue, b.targetValue) -
      targetDeviationMagnitude(a.currentValue, a.targetValue);
    if (deviationDiff !== 0) {
      return deviationDiff;
    }

    return a.id.localeCompare(b.id);
  });

  return ranked.slice(0, limit);
}
