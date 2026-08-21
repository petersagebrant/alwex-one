import { hasValidKpiCurrentValue } from "@/lib/kpi/kind";
import {
  hasTwoParseableReportedValues,
  isUsableBriefingTargetKpi,
  type DashboardTargetKpi,
} from "@/lib/kpi/reportedTargetKpis";

export type BriefingTrendDirection =
  | "bättre"
  | "sämre"
  | "oförändrad"
  | "okänd";

export type BriefingTrendSource = "kpi_history" | "audit_log" | "updated_at" | "none";

function statusRank(status: string | null | undefined): number | null {
  if (status === "Grön") return 2;
  if (status === "Gul") return 1;
  if (status === "Röd") return 0;
  return null;
}

function directionFromStatuses(
  previous: string | null | undefined,
  current: string | null | undefined,
): BriefingTrendDirection {
  const previousRank = statusRank(previous);
  const currentRank = statusRank(current);
  if (previousRank == null || currentRank == null) {
    return "okänd";
  }
  const delta = currentRank - previousRank;
  if (delta > 0) return "bättre";
  if (delta < 0) return "sämre";
  return "oförändrad";
}

/**
 * Positive/negative KPI trend only from two parseable live history values
 * plus a currently reported TARGET. Audit log is never a trend source.
 */
export function briefingTrendDirection(input: {
  liveCurrentValue: string | null | undefined;
  isPeriodPending?: boolean;
  previousValue: string | null | undefined;
  currentValue: string | null | undefined;
  previousStatus?: string | null;
  currentStatus?: string | null;
  source: BriefingTrendSource;
}): BriefingTrendDirection {
  if (input.source !== "kpi_history") {
    return "okänd";
  }
  if (input.isPeriodPending) {
    return "okänd";
  }
  if (!hasValidKpiCurrentValue(input.liveCurrentValue)) {
    return "okänd";
  }
  if (!hasTwoParseableReportedValues(input.previousValue, input.currentValue)) {
    return "okänd";
  }
  return directionFromStatuses(input.previousStatus, input.currentStatus);
}

export function canUseKpiHistoryAsTrend(
  kpi: DashboardTargetKpi,
  kpisById?: Map<string, { currentValue?: string | null }> | null,
): boolean {
  return isUsableBriefingTargetKpi(kpi, kpisById);
}

/** Audit must never create current trend after KPI cleanup. */
export function canUseAuditAsKpiTrendSource(): boolean {
  return false;
}

export function isBriefingKpiChangeTrendItem(item: {
  source: BriefingTrendSource;
  previousValue: string | null | undefined;
  currentValue: string | null | undefined;
}): boolean {
  return (
    item.source === "kpi_history" &&
    hasTwoParseableReportedValues(item.previousValue, item.currentValue)
  );
}

