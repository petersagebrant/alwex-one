const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MISSING_DATE = "—";

function parseDisplayDate(value: string): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = DATE_ONLY.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(
        /[+-]\d{2}$/.test(trimmed) ? `${trimmed}:00` : trimmed,
      );

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateSv(isoDate: string): string {
  const date = parseDisplayDate(isoDate);
  if (!date) {
    return MISSING_DATE;
  }

  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTimeSv(isoDateTime: string): string {
  const date = parseDisplayDate(isoDateTime);
  if (!date) {
    return MISSING_DATE;
  }

  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
