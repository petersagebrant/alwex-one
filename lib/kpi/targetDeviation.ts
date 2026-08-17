import { parseNumeric } from "@/lib/kpi/parseNumeric";

/**
 * Absolute relative deviation from target (0…∞).
 * Used to rank same-status TARGET KPIs — larger miss ranks higher.
 * Returns 0 when current/target cannot be parsed.
 */
export function targetDeviationMagnitude(
  currentValue: string | null | undefined,
  targetValue: string | null | undefined,
): number {
  const current = parseNumeric(currentValue);
  const target = parseNumeric(targetValue);
  if (current === null || target === null) {
    return 0;
  }
  const denom = Math.abs(target);
  if (denom === 0) {
    return Math.abs(current);
  }
  return Math.abs(current - target) / denom;
}
