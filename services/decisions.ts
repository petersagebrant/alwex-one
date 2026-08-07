import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import {
  fetchAllDecisions,
  fetchDecisionById,
  insertDecision,
  updateDecisionRow,
} from "@/lib/supabase/decisions";
import { recordAuditLog } from "@/services/auditLog";
import {
  collectFieldChanges,
  formatEntityChangeDescription,
  resolveActorName,
} from "@/services/changeHistory";
import type {
  CreateDecisionInput,
  Decision,
  DecisionStatus,
  UpdateDecisionInput,
} from "@/types";

const DEFAULT_ACTOR = "Peter Sagebrant";

const DECISION_TRACKED_FIELDS = [
  "title",
  "owner",
  "status",
  "meeting_date",
  "due_date",
  "business_area_id",
] as const;

function toStatus(value: string): DecisionStatus {
  if (value === "Planerat" || value === "Pågår" || value === "Klart") {
    return value;
  }
  return "Planerat";
}

function mapDecisionRow(row: {
  id: string;
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  meeting_date: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}): Decision {
  return {
    id: row.id,
    businessAreaId: row.business_area_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    meetingDate: row.meeting_date,
    dueDate: row.due_date,
    status: toStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type DecisionListItem = Decision & {
  businessAreaName: string;
};

export async function getDecisions(): Promise<DecisionListItem[]> {
  const [rows, areas] = await Promise.all([
    fetchAllDecisions(),
    fetchBusinessAreas(),
  ]);

  const areaNames = new Map(areas.map((area) => [area.id, area.name]));

  return rows.map((row) => ({
    ...mapDecisionRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
  }));
}

export async function getDecisionById(
  id: string,
): Promise<DecisionListItem | null> {
  const row = await fetchDecisionById(id);
  if (!row) {
    return null;
  }

  const areas = await fetchBusinessAreas();
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));

  return {
    ...mapDecisionRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
  };
}

export async function getUpcomingDecisions(
  limit = 5,
): Promise<DecisionListItem[]> {
  try {
    const decisions = await getDecisions();

    return decisions
      .filter((decision) => decision.status !== "Klart")
      .sort((a, b) => {
        const aDate = a.dueDate ?? a.meetingDate ?? "9999-12-31";
        const bDate = b.dueDate ?? b.meetingDate ?? "9999-12-31";
        return aDate.localeCompare(bDate);
      })
      .slice(0, limit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("decisions") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }
}

export async function createDecision(
  input: CreateDecisionInput,
): Promise<Decision> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Titel är obligatorisk.");
  }

  if (!input.businessAreaId) {
    throw new Error("businessAreaId är obligatoriskt.");
  }

  const row = await insertDecision({
    business_area_id: input.businessAreaId,
    title,
    description: input.description?.trim() || null,
    owner: input.owner?.trim() || null,
    meeting_date: input.meetingDate || null,
    due_date: input.dueDate || null,
    status: input.status,
  });

  await recordAuditLog({
    entityType: "decision",
    entityId: row.id,
    action: "created",
    description: `Skapade beslutet "${row.title}"`,
    actorName: input.owner?.trim() || DEFAULT_ACTOR,
    businessAreaId: row.business_area_id,
  });

  return mapDecisionRow(row);
}

export async function updateDecision(
  input: UpdateDecisionInput,
): Promise<Decision> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Titel är obligatorisk.");
  }

  if (!input.id) {
    throw new Error("id är obligatoriskt.");
  }

  if (!input.businessAreaId) {
    throw new Error("businessAreaId är obligatoriskt.");
  }

  const existing = await fetchDecisionById(input.id);
  if (!existing) {
    throw new Error("Beslutet hittades inte.");
  }

  const next = {
    business_area_id: input.businessAreaId,
    title,
    description: input.description?.trim() || null,
    owner: input.owner?.trim() || null,
    meeting_date: input.meetingDate || null,
    due_date: input.dueDate || null,
    status: input.status,
  };

  const changes = collectFieldChanges(
    {
      business_area_id: existing.business_area_id,
      title: existing.title,
      owner: existing.owner,
      meeting_date: existing.meeting_date,
      due_date: existing.due_date,
      status: existing.status,
    },
    next,
    DECISION_TRACKED_FIELDS,
  );

  const row = await updateDecisionRow(input.id, {
    ...next,
    updated_at: new Date().toISOString(),
  });

  if (changes.length > 0) {
    const actorName = await resolveActorName(
      input.owner?.trim() || DEFAULT_ACTOR,
    );
    await recordAuditLog({
      entityType: "decision",
      entityId: row.id,
      action: "updated",
      description: formatEntityChangeDescription(
        "beslutet",
        row.title,
        changes,
      ),
      actorName,
      businessAreaId: row.business_area_id,
      changes: { fields: changes },
    });
  }

  return mapDecisionRow(row);
}

export async function markDecisionComplete(id: string): Promise<Decision> {
  const existing = await fetchDecisionById(id);
  if (!existing) {
    throw new Error("Beslutet hittades inte.");
  }

  const changes = collectFieldChanges(
    { status: existing.status },
    { status: "Klart" },
    ["status"],
  );

  const row = await updateDecisionRow(id, {
    business_area_id: existing.business_area_id,
    title: existing.title,
    description: existing.description,
    owner: existing.owner,
    meeting_date: existing.meeting_date,
    due_date: existing.due_date,
    status: "Klart",
    updated_at: new Date().toISOString(),
  });

  if (changes.length > 0) {
    const actorName = await resolveActorName(
      row.owner?.trim() || DEFAULT_ACTOR,
    );
    await recordAuditLog({
      entityType: "decision",
      entityId: row.id,
      action: "completed",
      description: formatEntityChangeDescription(
        "beslutet",
        row.title,
        changes,
      ),
      actorName,
      businessAreaId: row.business_area_id,
      changes: { fields: changes },
    });
  }

  return mapDecisionRow(row);
}
