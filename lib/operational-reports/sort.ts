import type { OperationalReportPriority } from "@/types/operational-report";

const PRIORITY_RANK: Record<OperationalReportPriority, number> = {
  urgent: 0,
  follow_up: 1,
  info: 2,
};

export function operationalReportPriorityRank(
  priority: OperationalReportPriority,
): number {
  return PRIORITY_RANK[priority];
}

/** Red/urgent first, then yellow/follow_up, then info. Newest within same rank. */
export function sortOperationalReportsByPriority<
  T extends { priority: OperationalReportPriority; createdAt: string },
>(reports: T[]): T[] {
  return [...reports].sort((a, b) => {
    const rank =
      operationalReportPriorityRank(a.priority) -
      operationalReportPriorityRank(b.priority);
    if (rank !== 0) {
      return rank;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}
