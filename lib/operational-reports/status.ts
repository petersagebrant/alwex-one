import {
  OPERATIONAL_REPORT_STATUSES,
  type OperationalReportStatus,
} from "@/types/operational-report";

export const ACTIVE_MORNING_STATUSES: readonly OperationalReportStatus[] = [
  "ny",
  "hanteras",
];

export function isOperationalReportStatus(
  value: string | null | undefined,
): value is OperationalReportStatus {
  return (OPERATIONAL_REPORT_STATUSES as readonly string[]).includes(
    value ?? "",
  );
}

export function isActiveMorningReport(status: OperationalReportStatus): boolean {
  return status === "ny" || status === "hanteras";
}

/** Linked action from a report: ny → hanteras. Never downgrade hanteras/klar. */
export function statusAfterCreatingLinkedAction(
  current: OperationalReportStatus,
): OperationalReportStatus {
  return current === "ny" ? "hanteras" : current;
}

export function filterActiveMorningReports<
  T extends { status: OperationalReportStatus },
>(reports: T[]): T[] {
  return reports.filter((report) => isActiveMorningReport(report.status));
}

export function nextOperationalReportStatuses(
  current: OperationalReportStatus,
): OperationalReportStatus[] {
  if (current === "ny") {
    return ["hanteras", "klar"];
  }
  if (current === "hanteras") {
    return ["ny", "klar"];
  }
  return ["ny", "hanteras"];
}
