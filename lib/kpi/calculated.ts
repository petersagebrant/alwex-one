import { parseNumeric } from "@/lib/kpi/parseNumeric";
import type { KpiCalcOperator } from "@/lib/kpi/kind";

export type { KpiCalcOperator };

export function isKpiCalcOperator(
  value: string | null | undefined,
): value is KpiCalcOperator {
  return (
    value === "DIVIDE" ||
    value === "SUM_DIVIDE" ||
    value === "MONTH_TO_DATE_SUM" ||
    value === "RATIO_PERCENT" ||
    value === "WEIGHTED_RATIO_PERCENT"
  );
}

export function parseKpiCalcOperator(
  value: string | null | undefined,
): KpiCalcOperator | null {
  return isKpiCalcOperator(value) ? value : null;
}

/** Format a finite number with Swedish decimal comma (max 3 decimals, trimmed). */
export function formatCalculatedValueSv(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  const rounded = Math.round(value * 1000) / 1000;
  const fixed = rounded.toFixed(3);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return trimmed.replace(".", ",");
}

/**
 * DIVIDE numerator / denominator for the same report_date.
 * Returns null when denominator is missing/0 or either side is non-numeric.
 */
export function computeDivideValue(
  numerator: string | number | null | undefined,
  denominator: string | number | null | undefined,
): string | null {
  const num = parseNumeric(numerator);
  const den = parseNumeric(denominator);
  if (num === null || den === null || den === 0) {
    return null;
  }
  return formatCalculatedValueSv(num / den);
}

/**
 * SUM_DIVIDE = SUM(numerators) / denominator for the same report_date.
 * Returns null when any numerator is missing, or denominator missing/0.
 */
export function computeSumDivideValue(
  numeratorValues: Array<string | number | null | undefined>,
  denominator: string | number | null | undefined,
): string | null {
  if (numeratorValues.length === 0) {
    return null;
  }
  const den = parseNumeric(denominator);
  if (den === null || den === 0) {
    return null;
  }
  let sum = 0;
  for (const raw of numeratorValues) {
    const num = parseNumeric(raw);
    if (num === null) {
      return null;
    }
    sum += num;
  }
  return formatCalculatedValueSv(sum / den);
}

/**
 * RATIO_PERCENT = numerator / denominator × 100 (e.g. sjuktimmar / ordinarie × 100).
 * Returns null when denominator is missing/0 or either side is non-numeric.
 */
export function computeRatioPercentValue(
  numerator: string | number | null | undefined,
  denominator: string | number | null | undefined,
): string | null {
  const num = parseNumeric(numerator);
  const den = parseNumeric(denominator);
  if (num === null || den === null || den === 0) {
    return null;
  }
  return formatCalculatedValueSv((num / den) * 100);
}

export type WeightedRatioPart = {
  numeratorValue: string | number | null | undefined;
  denominatorValue: string | number | null | undefined;
};

export type WeightedRatioResult = {
  /** Formatted % when at least one complete pair exists; else null. */
  value: string | null;
  /** AO pairs where both inputs are numeric and denominator ≠ 0. */
  reportedParts: number;
  totalParts: number;
  /** True when every configured pair is complete. */
  isComplete: boolean;
  /** Swedish completeness label, e.g. "5 av 7 affärsområden rapporterade". */
  completenessLabel: string;
};

function isCompleteRatioPart(part: WeightedRatioPart): boolean {
  const num = parseNumeric(part.numeratorValue);
  const den = parseNumeric(part.denominatorValue);
  return num !== null && den !== null && den !== 0;
}

/**
 * WEIGHTED_RATIO_PERCENT = SUM(numerators) / SUM(denominators) × 100
 * over complete pairs only. Incomplete pairs are excluded from the sums.
 * Never averages AO percentages.
 */
export function computeWeightedRatioPercent(
  parts: WeightedRatioPart[],
): WeightedRatioResult {
  const totalParts = parts.length;
  let reportedParts = 0;
  let sumNum = 0;
  let sumDen = 0;

  for (const part of parts) {
    if (!isCompleteRatioPart(part)) {
      continue;
    }
    const num = parseNumeric(part.numeratorValue)!;
    const den = parseNumeric(part.denominatorValue)!;
    reportedParts += 1;
    sumNum += num;
    sumDen += den;
  }

  const isComplete = totalParts > 0 && reportedParts === totalParts;
  const completenessLabel =
    totalParts === 0
      ? "0 av 0 affärsområden rapporterade"
      : `${reportedParts} av ${totalParts} affärsområden rapporterade`;

  if (reportedParts === 0 || sumDen === 0) {
    return {
      value: null,
      reportedParts,
      totalParts,
      isComplete,
      completenessLabel,
    };
  }

  return {
    value: formatCalculatedValueSv((sumNum / sumDen) * 100),
    reportedParts,
    totalParts,
    isComplete,
    completenessLabel,
  };
}

export function computeCalculatedValue(input: {
  operator: KpiCalcOperator | null | undefined;
  numeratorValue: string | number | null | undefined;
  denominatorValue: string | number | null | undefined;
  /** Required for SUM_DIVIDE — list of numerator values for the period. */
  numeratorValues?: Array<string | number | null | undefined>;
}): string | null {
  if (input.operator === "MONTH_TO_DATE_SUM") {
    const values = input.numeratorValues ?? [];
    if (values.length === 0) return null;
    let sum = 0;
    for (const value of values) {
      const parsed = parseNumeric(value);
      if (parsed === null) continue;
      sum += parsed;
    }
    return formatCalculatedValueSv(sum);
  }
  if (input.operator === "DIVIDE") {
    return computeDivideValue(input.numeratorValue, input.denominatorValue);
  }
  if (input.operator === "SUM_DIVIDE") {
    return computeSumDivideValue(
      input.numeratorValues ?? [],
      input.denominatorValue,
    );
  }
  if (input.operator === "RATIO_PERCENT") {
    return computeRatioPercentValue(
      input.numeratorValue,
      input.denominatorValue,
    );
  }
  return null;
}
