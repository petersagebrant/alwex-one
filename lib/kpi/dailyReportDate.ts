/**
 * Daily KPI report calendar dates in Europe/Stockholm.
 * Yesterday = Stockholm calendar day minus 1, never Date.now()-86400000.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD for a Date in Europe/Stockholm. */
export function stockholmCalendarDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Calendar yesterday in Europe/Stockholm: today's Stockholm date minus one
 * calendar day. Does not subtract 86400000 ms from the wall clock.
 */
export function stockholmCalendarYesterday(now: Date = new Date()): string {
  const today = stockholmCalendarDate(now);
  return addCalendarDays(today, -1);
}

/** True when `value` is a real YYYY-MM-DD calendar day (rejects 2026-02-31). */
export function parseIsoCalendarDate(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

export function isDailyReportDateNotFuture(
  reportDate: string,
  now: Date = new Date(),
): boolean {
  const parsed = parseIsoCalendarDate(reportDate);
  if (!parsed) return false;
  return parsed <= stockholmCalendarDate(now);
}

/**
 * Selected/default daily report date: valid YYYY-MM-DD not in the Stockholm
 * future, otherwise yesterday.
 */
export function resolveDailyReportDate(
  raw: string | null | undefined,
  now: Date = new Date(),
): string {
  const parsed = parseIsoCalendarDate(raw);
  if (parsed && isDailyReportDateNotFuture(parsed, now)) {
    return parsed;
  }
  return stockholmCalendarYesterday(now);
}

export function dailyReportDateRejectedReason(
  reportDate: string,
  now: Date = new Date(),
): string | null {
  if (!parseIsoCalendarDate(reportDate)) {
    return "Ogiltigt rapportdatum.";
  }
  if (!isDailyReportDateNotFuture(reportDate, now)) {
    return "Rapportdatum kan inte vara i framtiden.";
  }
  return null;
}

/**
 * Update kpis.current_value only when the reported day is on or after the
 * latest active history report_date. First report (no max) always updates.
 */
export function shouldUpdateKpiCurrentValue(
  reportDate: string,
  maxActiveReportDate: string | null,
): boolean {
  if (maxActiveReportDate == null || maxActiveReportDate === "") {
    return true;
  }
  return reportDate >= maxActiveReportDate;
}

/** Calendar day the value belongs to: period, report_date, else recorded_at. */
export function historyValueCalendarDate(entry: {
  periodMonth?: string | null;
  reportDate?: string | null;
  recordedAt: string;
}): string {
  return (
    entry.periodMonth ??
    entry.reportDate ??
    entry.recordedAt.slice(0, 10)
  );
}

export function compareHistoryByCalendarDate(
  a: {
    periodMonth?: string | null;
    reportDate?: string | null;
    recordedAt: string;
    updatedAt?: string;
    createdAt?: string;
  },
  b: typeof a,
): number {
  const dateCmp = historyValueCalendarDate(a).localeCompare(
    historyValueCalendarDate(b),
  );
  if (dateCmp !== 0) return dateCmp;
  return historyRegisteredAt(a).localeCompare(historyRegisteredAt(b));
}

/** When the row was saved: updated_at, else created_at, else recorded_at. */
export function historyRegisteredAt(entry: {
  updatedAt?: string | null;
  createdAt?: string | null;
  recordedAt: string;
}): string {
  return entry.updatedAt || entry.createdAt || entry.recordedAt;
}

function addCalendarDays(isoDate: string, delta: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  const yyyy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
