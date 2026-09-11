import { requireProfile, type AuthProfile } from "@/lib/auth/require-user";
import { canUpdateOperationalReportStatus } from "@/lib/operational-reports/permissions";
import { sortOperationalReportsByPriority } from "@/lib/operational-reports/sort";
import {
  filterActiveMorningReports,
  isOperationalReportStatus,
} from "@/lib/operational-reports/status";
import { isStockholmCalendarDay } from "@/lib/operational-reports/date";
import { stockholmCalendarDate } from "@/lib/kpi/dailyReportDate";
import {
  fetchOperationalReportById,
  fetchOperationalReports,
  insertPublicOperationalReport,
  listPublicOperationalReportAreas,
  updateOperationalReportStatusRow,
} from "@/lib/supabase/operational-reports";
import { listPublicReportingUnits } from "@/lib/supabase/reporting-units";
import { fetchAreaNoticeAreaLabels } from "@/lib/supabase/area-notices";
import type {
  CreateOperationalReportInput,
  OperationalReport,
  OperationalReportAreaOption,
  OperationalReportStatus,
  PublicReportingUnitOption,
} from "@/types/operational-report";

export type OperationalReportListItem = OperationalReport & {
  businessAreaName: string;
};

function mapReportRow(
  row: Awaited<ReturnType<typeof fetchOperationalReports>>[number],
  areaName: string,
): OperationalReportListItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    haulierName: row.haulier_name,
    businessAreaId: row.business_area_id,
    body: row.body,
    priority: row.priority,
    status: row.status,
    category: row.category,
    incidentKind: row.incident_kind,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    businessAreaName: areaName,
  };
}

export async function getPublicOperationalReportAreas(): Promise<
  OperationalReportAreaOption[]
> {
  return listPublicOperationalReportAreas();
}

export async function getPublicReportingUnits(): Promise<
  PublicReportingUnitOption[]
> {
  const rows = await listPublicReportingUnits();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    defaultBusinessAreaId: row.default_business_area_id,
  }));
}

export async function submitPublicOperationalReport(
  input: CreateOperationalReportInput,
): Promise<void> {
  await insertPublicOperationalReport({
    haulier_name: input.haulierName,
    business_area_id: input.businessAreaId,
    body: input.body,
    priority: input.priority,
    category: input.category,
    incident_kind: input.incidentKind ?? null,
  });
}

export async function getOperationalReports(): Promise<
  OperationalReportListItem[]
> {
  const [rows, labels] = await Promise.all([
    fetchOperationalReports(),
    fetchAreaNoticeAreaLabels(),
  ]);
  const names = new Map(labels.map((label) => [label.id, label.name]));
  return rows.map((row) =>
    mapReportRow(row, names.get(row.business_area_id) ?? "Okänt område"),
  );
}

export async function getDailySteeringReports(options?: {
  today?: string;
}): Promise<{
  active: OperationalReportListItem[];
  handledToday: OperationalReportListItem[];
}> {
  const today = options?.today ?? stockholmCalendarDate();
  const reports = await getOperationalReports();
  return {
    active: sortOperationalReportsByPriority(
      filterActiveMorningReports(reports),
    ),
    handledToday: reports.filter(
      (report) =>
        report.status === "klar" &&
        isStockholmCalendarDay(report.resolvedAt, today),
    ),
  };
}

export async function updateOperationalReportStatus(
  id: string,
  status: OperationalReportStatus,
  profile?: AuthProfile,
): Promise<OperationalReportListItem> {
  if (!isOperationalReportStatus(status)) {
    throw new Error("Ogiltig status.");
  }

  const actor = profile ?? (await requireProfile());
  const existing = await fetchOperationalReportById(id);
  if (!existing) {
    throw new Error("Rapporten hittades inte.");
  }

  if (
    !canUpdateOperationalReportStatus(
      actor.role,
      actor.businessAreaId,
      existing.business_area_id,
    )
  ) {
    throw new Error("Du saknar behörighet att ändra status.");
  }

  const row = await updateOperationalReportStatusRow(id, status);
  const labels = await fetchAreaNoticeAreaLabels();
  const areaName =
    labels.find((label) => label.id === row.business_area_id)?.name ??
    "Okänt område";
  return mapReportRow(row, areaName);
}
