/**
 * Whether updateKPI should append a kpi_history measurement point.
 *
 * A) Definition/metadata (direction, tolerance_*, green_tolerance, yellow_tolerance,
 *    name, category, unit, target, trend, business_area) and auto-recomputed
 *    status → no history.
 * B) Explicit current_value (utfall) change → history.
 *
 * createKPI still writes one initial history row when a valid numeric utfall
 * exists (initial measurement at create). Placeholders like "—" are never written.
 * Daily report uses upsertDailyKpiReport.
 * Status-only admin edits via the KPI form skip history; use /admin/kpis/[id]
 * or daily report for intentional measurement points.
 */
export function shouldWriteKpiMeasurementHistory(
  changes: { field: string }[],
): boolean {
  return changes.some((change) => change.field === "current_value");
}
