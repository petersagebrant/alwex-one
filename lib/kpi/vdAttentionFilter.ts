import type { KpiCalcOperator, KpiKind } from "@/lib/kpi/kind";

/**
 * Per-AO Sjukfrånvaro is TARGET + RATIO_PERCENT and already shown in the
 * "Sjukfrånvaro Alwex" comparison block. Exclude those from VD attention /
 * follow-up queues so only company total (WEIGHTED_RATIO_PERCENT) can warn.
 */
export function isExcludedFromVdAttention(kpi: {
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
}): boolean {
  return kpi.kind === "TARGET" && kpi.calcOperator === "RATIO_PERCENT";
}
