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

function linkedIdSet(
  linkedReportIds?: Iterable<string | null | undefined>,
): Set<string> | null {
  if (!linkedReportIds) {
    return null;
  }
  return new Set(
    [...linkedReportIds].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    ),
  );
}

/** Inkommet: only new reports. Linked reports never stay here. */
export function filterIncomingBoardReports<
  T extends { status: OperationalReportStatus; id?: string },
>(
  reports: T[],
  options?: { linkedReportIds?: Iterable<string | null | undefined> },
): T[] {
  const linkedIds = linkedIdSet(options?.linkedReportIds);
  return reports.filter((report) => {
    if (report.status !== "ny") {
      return false;
    }
    if (linkedIds && report.id && linkedIds.has(report.id)) {
      return false;
    }
    return true;
  });
}

/**
 * Att följa upp: handled reports without a linked activity.
 * Linked hanteras reports appear as the activity, not twice.
 */
export function filterFollowUpBoardReports<
  T extends { status: OperationalReportStatus; id?: string },
>(
  reports: T[],
  options?: { linkedReportIds?: Iterable<string | null | undefined> },
): T[] {
  const linkedIds = linkedIdSet(options?.linkedReportIds);
  return reports.filter((report) => {
    if (report.status !== "hanteras") {
      return false;
    }
    if (linkedIds && report.id && linkedIds.has(report.id)) {
      return false;
    }
    return true;
  });
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
  const linkedIds = linkedIdSet(options?.linkedReportIds);

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
