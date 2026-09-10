import { stockholmCalendarDate } from "@/lib/kpi/dailyReportDate";

/** e.g. "Torsdag 10 september" in Europe/Stockholm. */
export function formatStockholmMeetingDate(date: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function isStockholmCalendarDay(
  isoDateTime: string | null | undefined,
  day: string = stockholmCalendarDate(),
): boolean {
  if (!isoDateTime) {
    return false;
  }
  const parsed = new Date(isoDateTime);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return stockholmCalendarDate(parsed) === day;
}
