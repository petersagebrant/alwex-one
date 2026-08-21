import { isExcludedFromVdAttention } from "@/lib/kpi/vdAttentionFilter";
import {
  reportedTargetStatusTone,
  type AreaOperationalStatusKpi,
} from "@/lib/kpi/areaOperationalStatus";
import {
  hasValidKpiCurrentValue,
  isSystemComputedKpi,
  isTargetKpi,
  type KpiCalcOperator,
  type KpiKind,
} from "@/lib/kpi/kind";
import { parseNumeric } from "@/lib/kpi/parseNumeric";
import type { StatusTone } from "@/types/status";

export const BRIEFING_UNREPORTED_STATUS = "Ej rapporterat" as const;

export type DashboardTargetKpi = AreaOperationalStatusKpi & {
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
  calcNumeratorKpiId?: string | null;
  calcDenominatorKpiId?: string | null;
};

export type BriefingOperandKpi = {
  id?: string;
  currentValue?: string | null;
};

export function classifyDashboardTargetKpis<T extends DashboardTargetKpi>(
  kpis: T[],
): {
  greenKpis: T[];
  yellowKpis: T[];
  redKpis: T[];
  followUpKpis: T[];
} {
  const greenKpis: T[] = [];
  const yellowKpis: T[] = [];
  const redKpis: T[] = [];
  const followUpKpis: T[] = [];

  for (const kpi of kpis) {
    const tone = reportedTargetStatusTone(kpi);
    if (tone == null) {
      continue;
    }
    if (tone === "Grön") {
      greenKpis.push(kpi);
      continue;
    }
    if (isExcludedFromVdAttention(kpi)) {
      continue;
    }
    if (tone === "Gul") {
      yellowKpis.push(kpi);
      followUpKpis.push(kpi);
    } else if (tone === "Röd") {
      redKpis.push(kpi);
      followUpKpis.push(kpi);
    }
  }

  return { greenKpis, yellowKpis, redKpis, followUpKpis };
}

export function isFollowUpTargetTone(tone: StatusTone | null): boolean {
  return tone === "Gul" || tone === "Röd";
}

export function hasCompleteComputedOperands(
  kpi: DashboardTargetKpi,
  kpisById?: Map<string, BriefingOperandKpi> | null,
): boolean {
  if (!isSystemComputedKpi(kpi)) {
    return true;
  }
  if (!kpisById) {
    return true;
  }
  for (const operandId of [kpi.calcNumeratorKpiId, kpi.calcDenominatorKpiId]) {
    if (!operandId) {
      continue;
    }
    const operand = kpisById.get(operandId);
    if (!operand || !hasValidKpiCurrentValue(operand.currentValue)) {
      return false;
    }
  }
  return true;
}

/** TARGET with a live reported value and complete computed operands, if any. */
export function isUsableBriefingTargetKpi(
  kpi: DashboardTargetKpi,
  kpisById?: Map<string, BriefingOperandKpi> | null,
): boolean {
  return (
    reportedTargetStatusTone(kpi) != null &&
    hasCompleteComputedOperands(kpi, kpisById)
  );
}

export function isBriefingOpenKpiDeviation(
  kpi: DashboardTargetKpi,
  kpisById?: Map<string, BriefingOperandKpi> | null,
): boolean {
  return (
    isFollowUpTargetTone(reportedTargetStatusTone(kpi)) &&
    hasCompleteComputedOperands(kpi, kpisById)
  );
}

export function isUnreportedTargetKpi(kpi: DashboardTargetKpi): boolean {
  return isTargetKpi(kpi) && reportedTargetStatusTone(kpi) == null;
}

export function briefingTargetStatusLabel(kpi: DashboardTargetKpi): string {
  const tone = reportedTargetStatusTone(kpi);
  if (tone) {
    return tone;
  }
  if (isTargetKpi(kpi)) {
    return BRIEFING_UNREPORTED_STATUS;
  }
  return String(kpi.status);
}

export function hasTwoParseableReportedValues(
  previousValue: string | null | undefined,
  currentValue: string | null | undefined,
): boolean {
  return (
    parseNumeric(previousValue) !== null && parseNumeric(currentValue) !== null
  );
}

export function countUnreportedTargetKpis<T extends DashboardTargetKpi>(
  kpis: T[],
): number {
  return kpis.filter(isUnreportedTargetKpi).length;
}
