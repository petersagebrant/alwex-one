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
  T extends { status: OperationalReportStatus; id?: string },
>(
  reports: T[],
  options?: { linkedReportIds?: Iterable<string | null | undefined> },
): T[] {
  const linkedIds = options?.linkedReportIds
    ? new Set(
        [...options.linkedReportIds].filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        ),
      )
    : null;

  return reports.filter((report) => {
    if (!isActiveMorningReport(report.status)) {
      return false;
    }
    if (linkedIds && report.id && linkedIds.has(report.id)) {
      return false;
    }
    return true;
  });
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
