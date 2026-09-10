"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/require-user";
import { parseIsoCalendarDate, stockholmCalendarDate } from "@/lib/kpi/dailyReportDate";
import { isSteeringBoardActivityStatus } from "@/lib/operational-reports/boardPresentation";
import { canWriteOperationalForArea } from "@/lib/operational-reports/permissions";
import {
  isOperationalReportStatus,
  statusAfterCreatingLinkedAction,
} from "@/lib/operational-reports/status";
import {
  createSteeringActivity,
  patchSteeringActivity,
} from "@/services/activities";
import {
  getKPIById,
} from "@/services/kpis";
import {
  updateOperationalReportStatus,
} from "@/services/operationalReports";
import { fetchOperationalReportById } from "@/lib/supabase/operational-reports";
import type { ActivityPriority } from "@/types/activity";
import type { OperationalReportStatus } from "@/types/operational-report";

function firstParam(value: FormDataEntryValue | null): string {
  return String(value ?? "");
}

function revalidateSteering() {
  revalidatePath("/daglig-styrning");
}

export async function updateOperationalReportStatusAction(formData: FormData) {
  const profile = await requireProfile();
  const id = firstParam(formData.get("id")).trim();
  const status = firstParam(formData.get("status")).trim();

  if (!id || !isOperationalReportStatus(status)) {
    return;
  }

  await updateOperationalReportStatus(id, status, profile);
  revalidateSteering();
}

function titleFromText(value: string, fallback: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return fallback;
  }
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
}

function parseDeadline(raw: string): string | undefined {
  const parsed = parseIsoCalendarDate(raw.trim());
  return parsed ?? undefined;
}

export async function createSteeringActivityAction(formData: FormData) {
  const profile = await requireProfile();
  const sourceType = firstParam(formData.get("sourceType")).trim();
  const sourceId = firstParam(formData.get("sourceId")).trim();
  const businessAreaId = firstParam(formData.get("businessAreaId")).trim();
  const ownerId = firstParam(formData.get("ownerId")).trim();
  const titleInput = firstParam(formData.get("title")).trim();
  const escalationNote = firstParam(formData.get("escalationNote")).trim();
  const deadline =
    parseDeadline(firstParam(formData.get("deadline"))) ??
    stockholmCalendarDate();
  const requiresEscalation =
    firstParam(formData.get("requiresEscalation")) === "1" ||
    Boolean(escalationNote);

  if (!sourceId || !businessAreaId) {
    return;
  }

  if (requiresEscalation && !escalationNote) {
    return;
  }

  if (!requiresEscalation && !titleInput) {
    return;
  }

  if (
    !canWriteOperationalForArea(
      profile.role,
      profile.businessAreaId,
      businessAreaId,
    )
  ) {
    return;
  }

  let title = titleInput || "Åtgärd";
  let description: string | undefined;
  let operationalReportId: string | null = null;
  let linkedReportStatus: OperationalReportStatus | null = null;
  let sourceKpiId: string | null = null;
  let priority: ActivityPriority = "Normal";

  if (sourceType === "report") {
    const report = await fetchOperationalReportById(sourceId);
    if (!report || report.business_area_id !== businessAreaId) {
      return;
    }
    if (!titleInput) {
      title = titleFromText(
        `${report.haulier_name}: ${report.body}`,
        "Åtgärd från rapport",
      );
    }
    description = report.body;
    operationalReportId = report.id;
    linkedReportStatus = report.status;
    if (report.priority === "urgent") {
      priority = "Hög";
    }
  } else if (sourceType === "kpi") {
    const kpi = await getKPIById(sourceId);
    if (!kpi || kpi.businessAreaId !== businessAreaId) {
      return;
    }
    if (!titleInput) {
      title = titleFromText(`KPI: ${kpi.name}`, "Åtgärd från KPI");
    }
    description = [
      kpi.businessAreaName,
      kpi.currentValue && kpi.targetValue
        ? `${kpi.currentValue} mot mål ${kpi.targetValue}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    sourceKpiId = kpi.id;
    if (kpi.status === "Röd") {
      priority = "Hög";
    }
  } else {
    return;
  }

  await createSteeringActivity(
    {
      businessAreaId,
      title,
      description,
      ownerId: ownerId || null,
      deadline,
      status: "Ej påbörjad",
      priority,
      operationalReportId,
      sourceKpiId,
      requiresEscalation,
      escalationNote: escalationNote || null,
    },
    profile,
  );

  if (operationalReportId && linkedReportStatus) {
    const nextStatus = statusAfterCreatingLinkedAction(linkedReportStatus);
    if (nextStatus !== linkedReportStatus) {
      await updateOperationalReportStatus(
        operationalReportId,
        nextStatus,
        profile,
      );
    }
  }

  revalidateSteering();
}

export async function createAdHocSteeringActivityAction(formData: FormData) {
  const profile = await requireProfile();
  const businessAreaId = firstParam(formData.get("businessAreaId")).trim();
  const title = firstParam(formData.get("title")).trim();
  const ownerId = firstParam(formData.get("ownerId")).trim();
  const deadline =
    parseDeadline(firstParam(formData.get("deadline"))) ??
    stockholmCalendarDate();

  if (!businessAreaId || !title) {
    return;
  }

  await createSteeringActivity(
    {
      businessAreaId,
      title,
      ownerId: ownerId || null,
      deadline,
      status: "Ej påbörjad",
      priority: "Normal",
    },
    profile,
  );
  revalidateSteering();
}

export async function patchSteeringActivityAction(formData: FormData) {
  const profile = await requireProfile();
  const id = firstParam(formData.get("id")).trim();
  const intent = firstParam(formData.get("intent")).trim();

  if (!id) {
    return;
  }

  if (intent === "status") {
    const status = firstParam(formData.get("status")).trim();
    if (!isSteeringBoardActivityStatus(status)) {
      return;
    }
    await patchSteeringActivity({ id, status }, profile);
    revalidateSteering();
    return;
  }

  if (intent === "escalation") {
    const escalationNote = firstParam(formData.get("escalationNote")).trim();
    if (!escalationNote) {
      return;
    }
    await patchSteeringActivity(
      {
        id,
        requiresEscalation: true,
        escalationNote,
      },
      profile,
    );
    revalidateSteering();
    return;
  }

  if (intent === "end-escalation") {
    await patchSteeringActivity(
      {
        id,
        requiresEscalation: false,
      },
      profile,
    );
    revalidateSteering();
  }
}
