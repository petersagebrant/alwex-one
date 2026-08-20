import {
  hasValidKpiCurrentValue,
  isCalculatedKpi,
  isStatisticKpi,
  isStatusTone,
  isTargetKpi,
  type KpiKind,
} from "@/lib/kpi/kind";
import type { StatusTone } from "@/types/status";

/**
 * How a KPI should appear in the Status column on area/overview lists.
 * Manual STATISTIC: Rapporterad / Ej rapporterad (never "Statistik").
 * CALCULATED: Beräknad. TARGET: G/Y/R or Ej rapporterad.
 */
export type KpiStatusPresentation =
  | { kind: "rapporterad" }
  | { kind: "ej_rapporterad" }
  | { kind: "beraknad" }
  | { kind: "tone"; status: StatusTone }
  | { kind: "none" };

export function resolveKpiStatusPresentation(kpi: {
  kind: KpiKind;
  status: string;
  currentValue?: string | null;
}): KpiStatusPresentation {
  if (isStatisticKpi(kpi)) {
    return hasValidKpiCurrentValue(kpi.currentValue)
      ? { kind: "rapporterad" }
      : { kind: "ej_rapporterad" };
  }
  if (isCalculatedKpi(kpi)) {
    return { kind: "beraknad" };
  }
  if (isTargetKpi(kpi) && !hasValidKpiCurrentValue(kpi.currentValue)) {
    return { kind: "ej_rapporterad" };
  }
  if (isStatusTone(kpi.status)) {
    return { kind: "tone", status: kpi.status };
  }
  return { kind: "none" };
}
