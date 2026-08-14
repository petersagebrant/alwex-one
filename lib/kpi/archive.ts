/** Soft-archive: archivedAt set means hidden from operational views. */
export function isKpiArchived(kpi: { archivedAt: string | null }): boolean {
  return Boolean(kpi.archivedAt);
}
