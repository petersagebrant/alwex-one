import type { StatusTone } from "@/types/status";

export type KpiKind = "TARGET" | "STATISTIC";

/** Stored on kpis/kpi_history for statistics — never shown as "-" in UI. */
export const STATISTIC_STATUS = "Statistik" as const;

export type KpiStoredStatus = StatusTone | typeof STATISTIC_STATUS;

export function isKpiKind(value: string | null | undefined): value is KpiKind {
  return value === "TARGET" || value === "STATISTIC";
}

export function parseKpiKind(value: string | null | undefined): KpiKind {
  return value === "STATISTIC" ? "STATISTIC" : "TARGET";
}

export function isStatisticKpi(kpi: { kind: KpiKind }): boolean {
  return kpi.kind === "STATISTIC";
}

export function isTargetKpi(kpi: { kind: KpiKind }): boolean {
  return kpi.kind === "TARGET";
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
