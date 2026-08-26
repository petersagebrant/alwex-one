import type { KpiCalcOperator, KpiKind } from "@/lib/kpi/kind";
import { isMonthlyRevenueVsBudgetKpi } from "@/lib/kpi/economics";

/**
 * Per-AO Sjukfrånvaro uses a daily or month-to-date ratio TARGET and is already
 * shown in the "Sjukfrånvaro Alwex" comparison block. Exclude those from VD
 * attention / follow-up queues so only company total can warn.
 *
 * Omsättning mot budget is the economic sibling of Resultat mot budget.
 * Resultat is the huvud-KPI; excluding this name prevents two economy TARGET
 * lights on the VD dashboard.
 */
export function isExcludedFromVdAttention(kpi: {
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
  name?: string | null;
}): boolean {
  if (isMonthlyRevenueVsBudgetKpi(kpi)) {
    return true;
  }
  return (
    kpi.kind === "TARGET" &&
    (kpi.calcOperator === "RATIO_PERCENT" ||
      kpi.calcOperator === "MONTH_TO_DATE_RATIO_PERCENT")
  );
}
