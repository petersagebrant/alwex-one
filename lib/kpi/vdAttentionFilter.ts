import type { KpiCalcOperator, KpiKind } from "@/lib/kpi/kind";

/**
 * Per-AO Sjukfrånvaro uses a daily or month-to-date ratio TARGET and is already
 * shown in the "Sjukfrånvaro Alwex" comparison block. Exclude those from VD
 * attention / follow-up queues so only company total can warn.
 */
export function isExcludedFromVdAttention(kpi: {
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
}): boolean {
  return (
    kpi.kind === "TARGET" &&
    (kpi.calcOperator === "RATIO_PERCENT" ||
      kpi.calcOperator === "MONTH_TO_DATE_RATIO_PERCENT")
  );
}
