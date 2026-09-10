import { isStockholmCalendarDay } from "./date";
import { isActiveMorningReport } from "./status";
import type {
  OperationalReportCategory,
  OperationalReportIncidentKind,
  OperationalReportStatus,
} from "@/types/operational-report";

export type SafetyIncidentCounts = {
  olyckor: number;
  tillbud: number;
  allvarligaRisker: number;
};

export function emptySafetyIncidentCounts(): SafetyIncidentCounts {
  return { olyckor: 0, tillbud: 0, allvarligaRisker: 0 };
}

function bumpKind(
  counts: SafetyIncidentCounts,
  kind: OperationalReportIncidentKind | null,
): void {
  if (kind === "olycka") {
    counts.olyckor += 1;
    return;
  }
  if (kind === "tillbud") {
    counts.tillbud += 1;
    return;
  }
  if (kind === "allvarlig_risk") {
    counts.allvarligaRisker += 1;
  }
}

/** Open safety reports for the Stockholm calendar day. Klar is not active. */
export function countSafetyIncidentsForDay<
  T extends {
    category: OperationalReportCategory;
    incidentKind: OperationalReportIncidentKind | null;
    createdAt: string;
    status: OperationalReportStatus;
  },
>(reports: T[], today: string): SafetyIncidentCounts {
  const counts = emptySafetyIncidentCounts();
  for (const report of reports) {
    if (report.category !== "sakerhet") {
      continue;
    }
    if (!isActiveMorningReport(report.status)) {
      continue;
    }
    if (!isStockholmCalendarDay(report.createdAt, today)) {
      continue;
    }
    bumpKind(counts, report.incidentKind);
  }
  return counts;
}

export function formatSafetyIncidentLine(counts: SafetyIncidentCounts): string {
  return `${counts.olyckor} olyckor | ${counts.tillbud} tillbud | ${counts.allvarligaRisker} allvarliga risker`;
}
