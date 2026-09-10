export const OPERATIONAL_REPORT_PRIORITIES = [
  "info",
  "follow_up",
  "urgent",
] as const;

export type OperationalReportPriority =
  (typeof OPERATIONAL_REPORT_PRIORITIES)[number];

export const OPERATIONAL_REPORT_STATUSES = ["ny", "hanteras", "klar"] as const;

export type OperationalReportStatus =
  (typeof OPERATIONAL_REPORT_STATUSES)[number];

export const OPERATIONAL_REPORT_CATEGORIES = [
  "sakerhet",
  "drift",
  "ovrigt",
] as const;

export type OperationalReportCategory =
  (typeof OPERATIONAL_REPORT_CATEGORIES)[number];

export const OPERATIONAL_REPORT_INCIDENT_KINDS = [
  "olycka",
  "tillbud",
  "allvarlig_risk",
] as const;

export type OperationalReportIncidentKind =
  (typeof OPERATIONAL_REPORT_INCIDENT_KINDS)[number];

export const OPERATIONAL_REPORT_CATEGORY_LABELS: Record<
  OperationalReportCategory,
  string
> = {
  sakerhet: "Säkerhet",
  drift: "Drift",
  ovrigt: "Övrigt",
};

export const OPERATIONAL_REPORT_INCIDENT_KIND_LABELS: Record<
  OperationalReportIncidentKind,
  string
> = {
  olycka: "Olycka",
  tillbud: "Tillbud",
  allvarlig_risk: "Allvarlig risk",
};

export const OPERATIONAL_REPORT_HAULIER_MAX = 120;
export const OPERATIONAL_REPORT_BODY_MAX = 2000;

export const OPERATIONAL_REPORT_PRIORITY_LABELS: Record<
  OperationalReportPriority,
  string
> = {
  info: "Information",
  follow_up: "Behöver följas upp",
  urgent: "Akut",
};

export const OPERATIONAL_REPORT_STATUS_LABELS: Record<
  OperationalReportStatus,
  string
> = {
  ny: "Ny",
  hanteras: "Hanteras",
  klar: "Stäng rapport",
};

export type OperationalReport = {
  id: string;
  createdAt: string;
  haulierName: string;
  businessAreaId: string;
  body: string;
  priority: OperationalReportPriority;
  status: OperationalReportStatus;
  category: OperationalReportCategory;
  incidentKind: OperationalReportIncidentKind | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

export type CreateOperationalReportInput = {
  haulierName: string;
  businessAreaId: string;
  body: string;
  priority: OperationalReportPriority;
  category: OperationalReportCategory;
  incidentKind?: OperationalReportIncidentKind | null;
};

export type OperationalReportAreaOption = {
  id: string;
  name: string;
};
