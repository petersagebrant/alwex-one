import {
  OPERATIONAL_REPORT_CATEGORIES,
  OPERATIONAL_REPORT_INCIDENT_KINDS,
  type OperationalReportCategory,
  type OperationalReportIncidentKind,
  type OperationalReportPriority,
  type OperationalReportStatus,
} from "@/types/operational-report";
import { isActiveMorningReport } from "./status";

export type PublicReportCategoryValue = "sakerhet" | "drift" | "ovrigt";

export const PUBLIC_REPORT_CATEGORY_OPTIONS: ReadonlyArray<{
  value: PublicReportCategoryValue;
  label: string;
}> = [
  { value: "sakerhet", label: "Säkerhet / tillbud" },
  { value: "drift", label: "Drift / leverans" },
  { value: "ovrigt", label: "Övrigt" },
];

export function isOperationalReportCategory(
  value: string | null | undefined,
): value is OperationalReportCategory {
  return (OPERATIONAL_REPORT_CATEGORIES as readonly string[]).includes(
    value ?? "",
  );
}

export function isOperationalReportIncidentKind(
  value: string | null | undefined,
): value is OperationalReportIncidentKind {
  return (OPERATIONAL_REPORT_INCIDENT_KINDS as readonly string[]).includes(
    value ?? "",
  );
}

export function parsePublicReportCategory(value: string): {
  category: OperationalReportCategory;
  incidentKind: OperationalReportIncidentKind | null;
} | null {
  const trimmed = value.trim();
  if (trimmed === "drift" || trimmed === "ovrigt") {
    return { category: trimmed, incidentKind: null };
  }
  if (
    trimmed === "sakerhet" ||
    trimmed === "sakerhet_tillbud" ||
    trimmed === "sakerhet_olycka" ||
    trimmed === "sakerhet_allvarlig_risk"
  ) {
    return { category: "sakerhet", incidentKind: "tillbud" };
  }
  return null;
}

/** Open drift reports that need attention today — not info piles. */
export function isDriftAttentionReport(report: {
  category: OperationalReportCategory;
  priority: OperationalReportPriority;
  status: OperationalReportStatus;
}): boolean {
  return (
    report.category === "drift" &&
    (report.priority === "urgent" || report.priority === "follow_up") &&
    isActiveMorningReport(report.status)
  );
}

export function filterDriftAttentionReports<
  T extends {
    category: OperationalReportCategory;
    priority: OperationalReportPriority;
    status: OperationalReportStatus;
  },
>(reports: T[]): T[] {
  return reports.filter(isDriftAttentionReport);
}
