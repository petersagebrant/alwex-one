import { computeRatioPercentValue } from "@/lib/kpi/calculated";
import { computeKpiStatus } from "@/lib/kpi/computeStatus";
import { isSkippedDailyReportValue } from "@/lib/kpi/dailyKpiReport";
import { isStatisticKpi } from "@/lib/kpi/kind";
import type { StatusTone } from "@/types";

export type DailyKpiDisplayKpi = {
  status: string;
  kind: "TARGET" | "STATISTIC" | "CALCULATED";
  direction: string | null;
  toleranceType: string | null;
  greenTolerance: number | string | null;
  yellowTolerance: number | string | null;
  targetValue: string | null;
};

export type DailyKpiDisplayDraft = {
  value: string;
  status: StatusTone;
  comment: string;
  committedValue: string;
};

function isStatisticDisplayKpi(kpi: DailyKpiDisplayKpi): boolean {
  return isStatisticKpi(kpi) || kpi.status === "Statistik";
}

/** Status from an explicit value. Empty skip → null (no badge / no comment). */
export function computedDailyKpiStatus(
  kpi: DailyKpiDisplayKpi,
  value: string,
): StatusTone | null {
  if (isStatisticDisplayKpi(kpi)) return null;
  if (!kpi.direction) return null;
  if (isSkippedDailyReportValue(value)) return null;
  return computeKpiStatus({
    direction: kpi.direction,
    toleranceType: kpi.toleranceType,
    greenTolerance: kpi.greenTolerance,
    yellowTolerance: kpi.yellowTolerance,
    value,
    target: kpi.targetValue,
  });
}

/** Save/validation status from the live input (not the committed display). */
export function computedDailyKpiDraftStatus(
  kpi: DailyKpiDisplayKpi,
  draft: Pick<DailyKpiDisplayDraft, "value" | "status">,
): StatusTone {
  return computedDailyKpiStatus(kpi, draft.value) ?? draft.status;
}

export function commitDailyKpiDraft<T extends DailyKpiDisplayDraft>(
  kpi: DailyKpiDisplayKpi,
  draft: T,
): T {
  return {
    ...draft,
    committedValue: draft.value,
    status: computedDailyKpiDraftStatus(kpi, draft),
  };
}

export function dailyKpiDisplayStatus(
  kpi: DailyKpiDisplayKpi,
  draft: DailyKpiDisplayDraft,
): StatusTone {
  return computedDailyKpiStatus(kpi, draft.committedValue) ?? draft.status;
}

export function dailyKpiHasCommittedValue(draft: DailyKpiDisplayDraft): boolean {
  return !isSkippedDailyReportValue(draft.committedValue);
}

export function dailyKpiCommentRequired(
  kpi: DailyKpiDisplayKpi,
  draft: DailyKpiDisplayDraft,
): boolean {
  if (isStatisticDisplayKpi(kpi)) return false;
  if (!dailyKpiHasCommittedValue(draft)) return false;
  const status = dailyKpiDisplayStatus(kpi, draft);
  return status === "Gul" || status === "Röd";
}

export type RatioPercentPreviewKpi = {
  direction: string | null;
  toleranceType: string | null;
  greenTolerance: number | string | null;
  yellowTolerance: number | string | null;
  targetValue: string | null;
};

/** Calculated % + status from last-committed operands. Incomplete pair → no preview. */
export function committedRatioPercentPreview(
  resultKpi: RatioPercentPreviewKpi,
  committedNumerator: string,
  committedDenominator: string,
): { value: string | null; status: StatusTone | null } {
  if (
    isSkippedDailyReportValue(committedNumerator) ||
    isSkippedDailyReportValue(committedDenominator)
  ) {
    return { value: null, status: null };
  }
  const value = computeRatioPercentValue(
    committedNumerator,
    committedDenominator,
  );
  if (value == null) {
    return { value: null, status: null };
  }
  const status = computeKpiStatus({
    direction: resultKpi.direction,
    toleranceType: resultKpi.toleranceType,
    greenTolerance: resultKpi.greenTolerance,
    yellowTolerance: resultKpi.yellowTolerance,
    value,
    target: resultKpi.targetValue,
  });
  return { value, status };
}
