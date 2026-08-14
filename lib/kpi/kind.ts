import type { StatusTone } from "@/types/status";

export type KpiKind = "TARGET" | "STATISTIC" | "CALCULATED";

/** DIVIDE = CALCULATED Statistik; RATIO_* = system-computed TARGET with G/Y/R. */
export type KpiCalcOperator =
  | "DIVIDE"
  | "RATIO_PERCENT"
  | "WEIGHTED_RATIO_PERCENT";

/** Stored on kpis/kpi_history for statistics and calculated — never shown as "-" in UI. */
export const STATISTIC_STATUS = "Statistik" as const;

export type KpiStoredStatus = StatusTone | typeof STATISTIC_STATUS;

export function isKpiKind(value: string | null | undefined): value is KpiKind {
  return value === "TARGET" || value === "STATISTIC" || value === "CALCULATED";
}

export function parseKpiKind(value: string | null | undefined): KpiKind {
  if (value === "STATISTIC") return "STATISTIC";
  if (value === "CALCULATED") return "CALCULATED";
  return "TARGET";
}

export function isStatisticKpi(kpi: { kind: KpiKind }): boolean {
  return kpi.kind === "STATISTIC";
}

export function isCalculatedKpi(kpi: { kind: KpiKind }): boolean {
  return kpi.kind === "CALCULATED";
}

export function isTargetKpi(kpi: { kind: KpiKind }): boolean {
  return kpi.kind === "TARGET";
}

/** STATISTIC + CALCULATED — no Grön/Gul/Röd, excluded from G/Y/R counts. */
export function isNonTargetKpi(kpi: { kind: KpiKind }): boolean {
  return kpi.kind === "STATISTIC" || kpi.kind === "CALCULATED";
}

/** TARGET with calc_operator (RATIO_*) or CALCULATED — value is system-derived. */
export function isSystemComputedKpi(kpi: {
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
}): boolean {
  if (kpi.kind === "CALCULATED") return true;
  return kpi.kind === "TARGET" && kpi.calcOperator != null;
}

/** AO chef / daily report: TARGET + STATISTIC only (not system-computed). */
export function isManualReportableKpi(kpi: {
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
}): boolean {
  if (isSystemComputedKpi(kpi)) return false;
  return kpi.kind === "TARGET" || kpi.kind === "STATISTIC";
}

export function isStatusTone(value: string | null | undefined): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

export function isKpiStoredStatus(
  value: string | null | undefined,
): value is KpiStoredStatus {
  return isStatusTone(value) || value === STATISTIC_STATUS;
}

/** Parse KPI row status without coercing Statistik → Gul. */
export function parseKpiStoredStatus(
  value: string | null | undefined,
): KpiStoredStatus {
  if (isKpiStoredStatus(value)) {
    return value;
  }
  return "Gul";
}

/** Only Grön/Gul/Röd — for goals, areas, and TARGET KPI counts. */
export function parseStatusTone(
  value: string | null | undefined,
): StatusTone {
  if (isStatusTone(value)) {
    return value;
  }
  return "Gul";
}

export function targetKpisOnly<T extends { kind: KpiKind }>(kpis: T[]): T[] {
  return kpis.filter(isTargetKpi);
}

export function countTargetKpiStatuses(
  kpis: Array<{ kind: KpiKind; status: KpiStoredStatus }>,
): Record<StatusTone, number> {
  const statuses = targetKpisOnly(kpis)
    .map((kpi) => kpi.status)
    .filter(isStatusTone);
  return {
    Grön: statuses.filter((status) => status === "Grön").length,
    Gul: statuses.filter((status) => status === "Gul").length,
    Röd: statuses.filter((status) => status === "Röd").length,
  };
}
