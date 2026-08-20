/**
 * Parse a numeric string that may use Swedish decimal comma / whitespace.
 * Returns null when empty or not a finite number.
 */
export function parseNumeric(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (value == null) return null;
  const normalized = String(value)
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
