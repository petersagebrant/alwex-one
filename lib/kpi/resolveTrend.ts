import { parseNumeric } from "@/lib/kpi/parseNumeric";
import type { KpiTrend } from "@/types/kpi";

export type TrendHistoryPoint = {
  value: string;
  recordedAt?: string;
};

function isKpiTrend(value: string | null | undefined): value is KpiTrend {
  return value === "Upp" || value === "Oförändrad" || value === "Ner";
}

/**
 * Compute trend from the two most recent history points with numeric values.
 * History should be newest-first. Returns null when fewer than two points.
 */
export function computeTrendFromHistory(
  history: TrendHistoryPoint[],
): KpiTrend | null {
  const numeric: number[] = [];
  for (const entry of history) {
    const value = parseNumeric(entry.value);
    if (value !== null) {
      numeric.push(value);
    }
  }

  if (numeric.length < 2) {
    return null;
  }

  const latest = numeric[0]!;
  const previous = numeric[1]!;
  const epsilon = Math.max(Math.abs(previous) * 1e-9, 1e-9);

  if (Math.abs(latest - previous) <= epsilon) {
    return "Oförändrad";
  }
  return latest > previous ? "Upp" : "Ner";
}

/**
 * Display trend for VD views:
 * - Prefer stored trend when present and consistent with history
 * - If stored is missing/default (Oförändrad) and history can compute, use computed
 * - Never writes back — display-only
 */
export function resolveKpiTrend(
  stored: string | null | undefined,
  history: TrendHistoryPoint[],
): KpiTrend {
  const computed = computeTrendFromHistory(history);
  const storedTrend = isKpiTrend(stored) ? stored : null;

  if (storedTrend && computed) {
    if (storedTrend === computed) {
      return storedTrend;
    }
    // Stored Upp/Ner is treated as intentional; Oförändrad often means "unset".
    if (storedTrend === "Upp" || storedTrend === "Ner") {
      return storedTrend;
    }
    return computed;
  }

  if (storedTrend) {
    return storedTrend;
  }

  return computed ?? "Oförändrad";
}
