import { parseNumeric } from "@/lib/kpi/parseNumeric";
import type { StatusTone } from "@/types/status";

export type MeasurableAutoCalcInput = {
  currentValue: string | number | null | undefined;
  targetValue: string | number | null | undefined;
  deadline?: string | null;
  createdAt?: string | null;
  /** YYYY-MM-DD. Defaults to today in Europe/Stockholm. */
  today?: string | null;
};

export type MeasurableAutoCalcResult =
  | { computed: false; progress: null; status: null }
  | { computed: true; progress: number; status: StatusTone };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function stockholmDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toDateKey(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  if (DATE_ONLY.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return stockholmDateKey(parsed);
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T12:00:00Z`);
  const to = Date.parse(`${toKey}T12:00:00Z`);
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Auto progress + G/Y/R for MEASURABLE goals.
 *
 * Guard: skip when current is unparseable, target is unparseable, or target is 0
 * (`parseNumeric("Budget ±0")` is 0; `parseNumeric("Enligt plan")` is null).
 * Caller keeps stored progress/status on update, or defaults Gul/null on create.
 */
export function computeMeasurableProgressAndStatus(
  input: MeasurableAutoCalcInput,
): MeasurableAutoCalcResult {
  const current = parseNumeric(input.currentValue);
  const target = parseNumeric(input.targetValue);
  if (current == null || target == null || target === 0) {
    return { computed: false, progress: null, status: null };
  }

  const progress = Math.min(
    100,
    Math.max(0, Math.round((current / target) * 100)),
  );

  const today = toDateKey(input.today, stockholmDateKey(new Date()));
  const deadline = input.deadline?.trim()
    ? toDateKey(input.deadline, "")
    : "";

  if (!deadline) {
    if (progress >= 100) {
      return { computed: true, progress, status: "Grön" };
    }
    if (progress >= 70) {
      return { computed: true, progress, status: "Gul" };
    }
    return { computed: true, progress, status: "Röd" };
  }

  if (today > deadline) {
    if (progress < 100) {
      return { computed: true, progress, status: "Röd" };
    }
    return { computed: true, progress, status: "Grön" };
  }

  const start = toDateKey(input.createdAt, today);
  const totalDays = daysBetween(start, deadline);
  const elapsedDays = daysBetween(start, today);
  const expected =
    totalDays <= 0 ? 100 : (elapsedDays / totalDays) * 100;

  if (progress >= expected) {
    return { computed: true, progress, status: "Grön" };
  }
  if (progress >= expected - 15) {
    return { computed: true, progress, status: "Gul" };
  }
  return { computed: true, progress, status: "Röd" };
}