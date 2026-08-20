/**
 * Pure helpers for mapping WEIGHTED_RATIO_PERCENT inputs to per-AO
 * RATIO_PERCENT Sjukfrånvaro rows (sort order from weighted config).
 */

import { parseNumeric } from "@/lib/kpi/parseNumeric";

export type WeightedInputPair = {
  numeratorKpiId: string;
  denominatorKpiId: string;
  sortOrder: number;
};

export type RatioPercentKpiRef = {
  id: string;
  businessAreaId: string;
  calcNumeratorKpiId: string | null;
  calcDenominatorKpiId: string | null;
};

/**
 * Period value for weighted/AO sjukfrånvaro: prefer history for the report
 * date, otherwise fall back to kpis.current_value (same SoT as stored totals).
 */
export function resolvePeriodKpiValue(
  historyValue: string | null | undefined,
  currentValue: string | null | undefined,
): string | null {
  const fromHistory = historyValue?.trim();
  if (fromHistory) return fromHistory;
  const fromCurrent = currentValue?.trim();
  return fromCurrent || null;
}

/**
 * Same valid-input rule as computeWeightedRatioPercent / isCompleteRatioPart:
 * both sides numeric and denominator ≠ 0.
 */
export function hasValidRatioInputs(
  numeratorValue: string | null | undefined,
  denominatorValue: string | null | undefined,
): boolean {
  const num = parseNumeric(numeratorValue);
  const den = parseNumeric(denominatorValue);
  return num !== null && den !== null && den !== 0;
}

/**
 * Select and order AO RATIO_PERCENT KPIs by weighted-input sort_order (not by %).
 * Only pairs present in the weighted config are returned.
 */
export function orderRatioKpisByWeightedInputs<T extends RatioPercentKpiRef>(
  ratioKpis: T[],
  weightedInputs: WeightedInputPair[],
): T[] {
  if (weightedInputs.length === 0) {
    return [];
  }

  const byPair = new Map<string, T>();
  for (const kpi of ratioKpis) {
    if (!kpi.calcNumeratorKpiId || !kpi.calcDenominatorKpiId) continue;
    byPair.set(
      `${kpi.calcNumeratorKpiId}:${kpi.calcDenominatorKpiId}`,
      kpi,
    );
  }

  const ordered: T[] = [];
  const seen = new Set<string>();
  const sortedInputs = [...weightedInputs].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  for (const input of sortedInputs) {
    const key = `${input.numeratorKpiId}:${input.denominatorKpiId}`;
    const kpi = byPair.get(key);
    if (!kpi || seen.has(kpi.id)) continue;
    ordered.push(kpi);
    seen.add(kpi.id);
  }

  return ordered;
}
