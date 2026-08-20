/** Format a KPI value with optional unit for display. */
export function formatKpiDisplayValue(
  value: string | null | undefined,
  unit: string | null | undefined,
): string {
  const raw = value?.trim();
  if (!raw) return "—";
  const unitTrim = unit?.trim();
  return unitTrim ? `${raw} ${unitTrim}` : raw;
}
