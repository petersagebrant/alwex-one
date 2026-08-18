import { parseNumeric } from "@/lib/kpi/parseNumeric";
import type { StatusTone } from "@/types/status";

export type KpiKind = "TARGET" | "STATISTIC" | "CALCULATED";

/** DIVIDE / SUM_DIVIDE = CALCULATED Statistik; RATIO_* = system-computed TARGET with G/Y/R. */
export type KpiCalcOperator =
  | "DIVIDE"
  | "SUM_DIVIDE"
  | "MONTH_TO_DATE_SUM"
  | "RATIO_PERCENT"
  | "WEIGHTED_RATIO_PERCENT";

/** DAILY = today's reporting progress; MONTHLY = reportable but excluded from daily X av Y. */
export type KpiReportingFrequency = "DAILY" | "MONTHLY";

/** GROUPED = one composite report point; SEPARATE_INPUTS = each ratio input is its own point. */
export type KpiRatioReportingMode = "GROUPED" | "SEPARATE_INPUTS";

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

/** Company aggregate e.g. Sjukfrånvaro Alwex totalt (SUM/SUM×100). */
export function isWeightedRatioPercentKpi(kpi: {
  calcOperator?: KpiCalcOperator | null;
}): boolean {
  return kpi.calcOperator === "WEIGHTED_RATIO_PERCENT";
}

export function parseKpiReportingFrequency(
  value: string | null | undefined,
): KpiReportingFrequency {
  return value === "MONTHLY" ? "MONTHLY" : "DAILY";
}

export function parseKpiRatioReportingMode(
  value: string | null | undefined,
): KpiRatioReportingMode {
  return value === "SEPARATE_INPUTS" ? "SEPARATE_INPUTS" : "GROUPED";
}

export function isMonthlyReportingKpi(kpi: {
  reportingFrequency?: KpiReportingFrequency | null;
}): boolean {
  return kpi.reportingFrequency === "MONTHLY";
}

/** AO chef / daily report: TARGET + STATISTIC only (not system-computed). */
export function isManualReportableKpi(kpi: {
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
}): boolean {
  if (isSystemComputedKpi(kpi)) return false;
  return kpi.kind === "TARGET" || kpi.kind === "STATISTIC";
}

/** Manual KPIs that count toward today's daily reporting progress. */
export function isDailyManualReportableKpi(kpi: {
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
  reportingFrequency?: KpiReportingFrequency | null;
}): boolean {
  return isManualReportableKpi(kpi) && !isMonthlyReportingKpi(kpi);
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

/**
 * True when the KPI has a parseable numeric current value (reported or computed).
 * Empty/null/placeholders like "—" must not count as reported or inherit
 * a stale stored Grön/Gul/Röd for overview counts / key KPI selection.
 */
export function hasValidKpiCurrentValue(
  currentValue: string | null | undefined,
): boolean {
  return parseNumeric(currentValue) !== null;
}

/**
 * Effective G/Y/R for a TARGET KPI in overview/dashboard counts.
 * Missing current value → not counted (stale row status ignored).
 */
export function effectiveTargetStatusTone(kpi: {
  kind: KpiKind;
  status: KpiStoredStatus;
  currentValue?: string | null;
}): StatusTone | null {
  if (!isTargetKpi(kpi) || !hasValidKpiCurrentValue(kpi.currentValue)) {
    return null;
  }
  return isStatusTone(kpi.status) ? kpi.status : null;
}

export function countTargetKpiStatuses(
  kpis: Array<{
    kind: KpiKind;
    status: KpiStoredStatus;
    currentValue?: string | null;
  }>,
): Record<StatusTone, number> {
  const statuses = kpis
    .map(effectiveTargetStatusTone)
    .filter((status): status is StatusTone => status != null);
  return {
    Grön: statuses.filter((status) => status === "Grön").length,
    Gul: statuses.filter((status) => status === "Gul").length,
    Röd: statuses.filter((status) => status === "Röd").length,
  };
}
