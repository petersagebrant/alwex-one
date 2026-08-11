import type { StatusTone } from "@/types";
import { parseNumeric } from "@/lib/kpi/parseNumeric";

export type KpiDirection =
  | "HIGHER_IS_BETTER"
  | "LOWER_IS_BETTER"
  | "TARGET_IS_BEST";

export type KpiToleranceType = "PERCENT" | "ABSOLUTE";

export type ComputeKpiStatusInput = {
  direction: KpiDirection | string | null | undefined;
  toleranceType: KpiToleranceType | string | null | undefined;
  yellowTolerance: number | string | null | undefined;
  /** Optional green band for TARGET_IS_BEST. NULL → tiny heuristic. Ignored for HIGHER/LOWER. */
  greenTolerance?: number | string | null | undefined;
  value: number | string | null | undefined;
  target: number | string | null | undefined;
};

function isDirection(value: string): value is KpiDirection {
  return (
    value === "HIGHER_IS_BETTER" ||
    value === "LOWER_IS_BETTER" ||
    value === "TARGET_IS_BEST"
  );
}

function isToleranceType(value: string): value is KpiToleranceType {
  return value === "PERCENT" || value === "ABSOLUTE";
}

/**
 * Backward-compat green band when green_tolerance is NULL.
 * Used only for TARGET_IS_BEST.
 */
function targetIsBestGreenTiny(
  toleranceType: KpiToleranceType,
  yellowTolerance: number,
): number {
  if (toleranceType === "PERCENT") {
    // e.g. 0.5% or 10% of the yellow band, whichever is smaller (but > 0 when yellow > 0)
    return Math.min(0.5, Math.max(0, yellowTolerance * 0.1));
  }
  // 1% of yellow band; exact equality still counts as green when tiny is 0
  return Math.max(0, yellowTolerance * 0.01);
}

/**
 * Validate optional green/yellow bands. Returns an error message or null if ok.
 * green ≤ yellow when both are set; both must be ≥ 0.
 */
export function validateGreenYellowTolerances(
  greenTolerance: number | null | undefined,
  yellowTolerance: number | null | undefined,
): string | null {
  if (greenTolerance != null) {
    if (!Number.isFinite(greenTolerance) || greenTolerance < 0) {
      return "Ogiltig grön tolerans.";
    }
  }
  if (yellowTolerance != null) {
    if (!Number.isFinite(yellowTolerance) || yellowTolerance < 0) {
      return "Ogiltig gul tolerans.";
    }
  }
  if (
    greenTolerance != null &&
    yellowTolerance != null &&
    greenTolerance > yellowTolerance
  ) {
    return "Grön tolerans får inte vara större än gul tolerans.";
  }
  return null;
}

/**
 * Pure KPI status computation from direction + tolerances.
 * Returns null when auto-status cannot be computed (caller falls back to manual).
 *
 * TARGET_IS_BEST: deviation compared to green then yellow.
 * - ABSOLUTE: abs(value − target); with unit % this is percentage points.
 * - PERCENT: relative % of |target|.
 * - green_tolerance set → use it as green band (no tiny heuristic).
 * - green_tolerance NULL → tiny heuristic (backward compat).
 * HIGHER/LOWER ignore green_tolerance.
 */
export function computeKpiStatus(input: ComputeKpiStatusInput): StatusTone | null {
  const directionRaw =
    typeof input.direction === "string" ? input.direction.trim() : input.direction;
  if (!directionRaw || !isDirection(directionRaw)) {
    return null;
  }

  const toleranceRaw =
    typeof input.toleranceType === "string"
      ? input.toleranceType.trim()
      : input.toleranceType;
  if (!toleranceRaw || !isToleranceType(toleranceRaw)) {
    return null;
  }

  const yellowTolerance = parseNumeric(input.yellowTolerance);
  if (yellowTolerance === null || yellowTolerance < 0) {
    return null;
  }

  const value = parseNumeric(input.value);
  const target = parseNumeric(input.target);
  if (value === null || target === null) {
    return null;
  }

  if (directionRaw === "HIGHER_IS_BETTER") {
    if (value >= target) return "Grön";
    if (toleranceRaw === "PERCENT") {
      if (target === 0) return null; // percent of zero is undefined
      const worsePct = Math.max(0, (target - value) / Math.abs(target)) * 100;
      return worsePct <= yellowTolerance ? "Gul" : "Röd";
    }
    const worseAbs = Math.max(0, target - value);
    return worseAbs <= yellowTolerance ? "Gul" : "Röd";
  }

  if (directionRaw === "LOWER_IS_BETTER") {
    if (value <= target) return "Grön";
    if (toleranceRaw === "PERCENT") {
      if (target === 0) return null;
      const worsePct = Math.max(0, (value - target) / Math.abs(target)) * 100;
      return worsePct <= yellowTolerance ? "Gul" : "Röd";
    }
    const worseAbs = Math.max(0, value - target);
    return worseAbs <= yellowTolerance ? "Gul" : "Röd";
  }

  // TARGET_IS_BEST — dual band: green then yellow
  const greenParsed = parseNumeric(input.greenTolerance);
  const greenBand =
    greenParsed !== null && greenParsed >= 0
      ? greenParsed
      : targetIsBestGreenTiny(toleranceRaw, yellowTolerance);

  if (toleranceRaw === "PERCENT") {
    if (target === 0) return null;
    const deviationPct = (Math.abs(value - target) / Math.abs(target)) * 100;
    if (deviationPct <= greenBand) return "Grön";
    if (deviationPct <= yellowTolerance) return "Gul";
    return "Röd";
  }

  // ABSOLUTE: abs(value − target). With unit % this is percentage points from target.
  const deviationAbs = Math.abs(value - target);
  if (deviationAbs <= greenBand) return "Grön";
  if (deviationAbs <= yellowTolerance) return "Gul";
  return "Röd";
}

/** Default tolerance type when direction is set but type omitted in admin UI. */
export function defaultToleranceTypeForTarget(
  target: number | string | null | undefined,
): KpiToleranceType {
  const t = parseNumeric(target);
  if (t === null || Math.abs(t) < 1e-9) {
    return "ABSOLUTE";
  }
  return "PERCENT";
}
