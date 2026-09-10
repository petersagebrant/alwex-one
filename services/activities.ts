import {
  fetchBusinessAreaById,
  fetchBusinessAreas,
} from "@/lib/supabase/business-areas";
import {
  fetchActivitiesByBusinessAreaId,
  fetchActivitiesByGoalId,
  fetchActivityById,
  fetchAllActivities,
  insertActivity,
  updateActivityRow,
  updateActivitySteeringRow,
} from "@/lib/supabase/activities";
import {
  fetchAllGoals,
  fetchGoalsByBusinessAreaId,
} from "@/lib/supabase/goals";
import { fetchProfileById } from "@/lib/supabase/profiles";
import { profileAssignmentLabel } from "@/lib/goals/owner";
import type { AuthProfile } from "@/lib/auth/require-user";
import { parseIsoCalendarDate } from "@/lib/kpi/dailyReportDate";
import { canWriteOperationalForArea } from "@/lib/operational-reports/permissions";
import { recordAuditLog } from "@/services/auditLog";
import {
  collectFieldChanges,
  formatEntityChangeDescription,
  formatEntityCreateDescription,
  resolveActorName,
  snapshotCreateChanges,
} from "@/services/changeHistory";
import type {
  Activity,
  ActivityPriority,
  ActivityStatus,
  CreateActivityInput,
  UpdateActivityInput,
} from "@/types";

const DEFAULT_ACTOR = "Peter Sagebrant";

const ACTIVITY_TRACKED_FIELDS = [
  "title",
  "description",
  "owner",
  "owner_id",
  "status",
  "priority",
  "deadline",
  "completed_at",
  "business_area_id",
  "goal_id",
] as const;

const STEERING_TRACKED_FIELDS = [
  "owner",
  "owner_id",
  "deadline",
  "status",
  "completed_at",
  "requires_escalation",
  "escalated_at",
  "escalation_note",
] as const;

function toStatus(value: string): ActivityStatus {
  if (
    value === "Ej påbörjad" ||
    value === "Pågår" ||
    value === "Klar" ||
    value === "Försenad"
  ) {
    return value;
  }
  return "Ej påbörjad";
}

function toPriority(value: string): ActivityPriority {
  if (value === "Låg" || value === "Normal" || value === "Hög") {
    return value;
  }
  return "Normal";
}

async function resolveActivityOwnerFields(input: {
  ownerId?: string | null;
  owner?: string | null;
}): Promise<{ ownerId: string | null; owner: string | null }> {
  const ownerId = input.ownerId?.trim() || null;
  if (ownerId) {
    const profile = await fetchProfileById(ownerId);
    if (!profile) {
      throw new Error("Vald ansvarig hittades inte.");
    }
    return {
      ownerId: profile.id,
      owner: profileAssignmentLabel(profile),
    };
  }

  return {
    ownerId: null,
    owner: input.owner?.trim() || null,
  };
}

function mapActivityRow(row: {
  id: string;
  business_area_id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  owner: string | null;
  owner_id?: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  operational_report_id?: string | null;
  source_kpi_id?: string | null;
  requires_escalation?: boolean | null;
  escalated_at?: string | null;
  escalation_note?: string | null;
}): Activity {
  return {
    id: row.id,
    businessAreaId: row.business_area_id,
    goalId: row.goal_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    ownerId: row.owner_id ?? null,
    status: toStatus(row.status),
    priority: toPriority(row.priority),
    deadline: row.deadline,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    operationalReportId: row.operational_report_id ?? null,
    sourceKpiId: row.source_kpi_id ?? null,
    requiresEscalation: Boolean(row.requires_escalation),
    escalatedAt: row.escalated_at ?? null,
    escalationNote: row.escalation_note ?? null,
  };
}

export type ActivityListItem = Activity & {
  businessAreaName: string;
  goalTitle: string | null;
};

export async function getActivities(options?: {
  businessAreaId?: string;
}): Promise<ActivityListItem[]> {
  const [rows, areas, goals] = await Promise.all([
    options?.businessAreaId
      ? fetchActivitiesByBusinessAreaId(options.businessAreaId)
      : fetchAllActivities(),
    options?.businessAreaId
      ? fetchBusinessAreaById(options.businessAreaId).then((area) =>
          area ? [area] : [],
        )
      : fetchBusinessAreas(),
    options?.businessAreaId
      ? fetchGoalsByBusinessAreaId(options.businessAreaId, {
          includeArchived: true,
        })
      : fetchAllGoals({ includeArchived: true }),
  ]);

  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const goalTitles = new Map(goals.map((goal) => [goal.id, goal.title]));

  return rows.map((row) => ({
    ...mapActivityRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
    goalTitle: row.goal_id ? (goalTitles.get(row.goal_id) ?? null) : null,
  }));
}

export async function getActivitiesByBusinessAreaId(
  businessAreaId: string,
): Promise<Activity[]> {
  const rows = await fetchActivitiesByBusinessAreaId(businessAreaId);
  return rows.map(mapActivityRow);
}

export async function getActivitiesByGoalId(
  goalId: string,
): Promise<Activity[]> {
  const rows = await fetchActivitiesByGoalId(goalId);
  return rows.map(mapActivityRow);
}

export async function createActivity(
  input: CreateActivityInput,
): Promise<Activity> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Titel är obligatorisk.");
  }

  if (!input.businessAreaId) {
    throw new Error("businessAreaId är obligatoriskt.");
  }

  const completedAt =
    input.status === "Klar" ? new Date().toISOString() : null;

  const ownerFields = await resolveActivityOwnerFields({
    ownerId: input.ownerId,
    owner: input.owner,
  });

  const payload = {
    business_area_id: input.businessAreaId,
    goal_id: input.goalId || null,
    title,
    description: input.description?.trim() || null,
    owner: ownerFields.owner,
    owner_id: ownerFields.ownerId,
    status: input.status,
    priority: input.priority,
    deadline: input.deadline || null,
    completed_at: completedAt,
    operational_report_id: input.operationalReportId || null,
    source_kpi_id: input.sourceKpiId || null,
    requires_escalation: Boolean(input.requiresEscalation),
    escalated_at: input.requiresEscalation ? new Date().toISOString() : null,
    escalation_note: input.escalationNote?.trim() || null,
  };

  const row = await insertActivity(payload);

  const createChanges = snapshotCreateChanges(payload, ACTIVITY_TRACKED_FIELDS);
  const actorName = await resolveActorName(
    ownerFields.owner || DEFAULT_ACTOR,
  );
  await recordAuditLog({
    entityType: "activity",
    entityId: row.id,
    action: "created",
    description: formatEntityCreateDescription("aktiviteten", row.title),
    actorName,
    businessAreaId: row.business_area_id,
    changes: createChanges.length > 0 ? { fields: createChanges } : null,
  });

  return mapActivityRow(row);
}

export async function getActivityById(
  id: string,
): Promise<ActivityListItem | null> {
  const row = await fetchActivityById(id);
  if (!row) {
    return null;
  }

  const [areas, goals] = await Promise.all([
    fetchBusinessAreas(),
    fetchAllGoals({ includeArchived: true }),
  ]);

  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const goalTitles = new Map(goals.map((goal) => [goal.id, goal.title]));

  return {
    ...mapActivityRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
    goalTitle: row.goal_id ? (goalTitles.get(row.goal_id) ?? null) : null,
  };
}

export async function updateActivity(
  input: UpdateActivityInput,
): Promise<Activity> {
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

  const existing = await fetchActivityById(input.id);
  if (!existing) {
    throw new Error("Aktiviteten hittades inte.");
  }

  const completedAt =
    input.status === "Klar"
      ? (existing.completed_at ?? new Date().toISOString())
      : null;

  const next = {
    business_area_id: input.businessAreaId,
    goal_id: input.goalId || null,
    title,
    description: input.description?.trim() || null,
    owner: input.owner?.trim() || null,
    status: input.status,
    priority: input.priority,
    deadline: input.deadline || null,
    completed_at: completedAt,
  };

  const changes = collectFieldChanges(
    {
      business_area_id: existing.business_area_id,
      goal_id: existing.goal_id,
      title: existing.title,
      description: existing.description,
      owner: existing.owner,
      status: existing.status,
      priority: existing.priority,
      deadline: existing.deadline,
      completed_at: existing.completed_at,
    },
    next,
    ACTIVITY_TRACKED_FIELDS,
  );

  const row = await updateActivityRow(input.id, {
    ...next,
    updated_at: new Date().toISOString(),
  });

  if (changes.length > 0) {
    const actorName = await resolveActorName(
      input.owner?.trim() || DEFAULT_ACTOR,
    );
    await recordAuditLog({
      entityType: "activity",
      entityId: row.id,
      action: "updated",
      description: formatEntityChangeDescription(
        "aktiviteten",
        row.title,
        changes,
      ),
      actorName,
      businessAreaId: row.business_area_id,
      changes: { fields: changes },
    });
  }

  return mapActivityRow(row);
}

export type SteeringActivityPatch = {
  id: string;
  ownerId?: string | null;
  deadline?: string;
  status?: ActivityStatus;
  requiresEscalation?: boolean;
  escalationNote?: string | null;
};

function assertCanWriteActivityArea(
  profile: AuthProfile,
  businessAreaId: string,
) {
  if (
    !canWriteOperationalForArea(
      profile.role,
      profile.businessAreaId,
      businessAreaId,
    )
  ) {
    throw new Error("Du saknar behörighet att ändra aktiviteten.");
  }
}

export async function createSteeringActivity(
  input: CreateActivityInput,
  profile: AuthProfile,
): Promise<Activity> {
  assertCanWriteActivityArea(profile, input.businessAreaId);
  return createActivity(input);
}

export async function patchSteeringActivity(
  input: SteeringActivityPatch,
  profile: AuthProfile,
): Promise<Activity> {
  if (!input.id) {
    throw new Error("id är obligatoriskt.");
  }

  const existing = await fetchActivityById(input.id);
  if (!existing) {
    throw new Error("Aktiviteten hittades inte.");
  }

  assertCanWriteActivityArea(profile, existing.business_area_id);

  let owner = existing.owner;
  let ownerId = existing.owner_id ?? null;
  if (input.ownerId !== undefined) {
    const resolved = await resolveActivityOwnerFields({
      ownerId: input.ownerId,
    });
    owner = resolved.owner;
    ownerId = resolved.ownerId;
  }

  const deadline =
    input.deadline !== undefined
      ? input.deadline.trim()
        ? parseIsoCalendarDate(input.deadline.trim())
        : null
      : existing.deadline;
  if (input.deadline !== undefined && input.deadline.trim() && !deadline) {
    throw new Error("Ogiltigt datum.");
  }

  const status = input.status ?? toStatus(existing.status);
  const completedAt =
    status === "Klar"
      ? (existing.completed_at ?? new Date().toISOString())
      : null;

  const requiresEscalation =
    input.requiresEscalation ?? Boolean(existing.requires_escalation);
  const escalatedAt = requiresEscalation
    ? (existing.escalated_at ?? new Date().toISOString())
    : existing.escalated_at;
  const escalationNote = requiresEscalation
    ? input.escalationNote !== undefined
      ? input.escalationNote?.trim() || null
      : existing.escalation_note
    : existing.escalation_note;

  const next = {
    owner,
    owner_id: ownerId,
    deadline,
    status,
    completed_at: completedAt,
    requires_escalation: requiresEscalation,
    escalated_at: escalatedAt,
    escalation_note: escalationNote,
  };

  const changes = collectFieldChanges(
    {
      owner: existing.owner,
      owner_id: existing.owner_id ?? null,
      deadline: existing.deadline,
      status: existing.status,
      completed_at: existing.completed_at,
      requires_escalation: existing.requires_escalation,
      escalated_at: existing.escalated_at,
      escalation_note: existing.escalation_note ?? null,
    },
    next,
    STEERING_TRACKED_FIELDS,
  );

  const row = await updateActivitySteeringRow(input.id, {
    ...next,
    updated_at: new Date().toISOString(),
  });

  if (changes.length > 0) {
    const actorName = await resolveActorName(owner || DEFAULT_ACTOR);
    await recordAuditLog({
      entityType: "activity",
      entityId: row.id,
      action: "updated",
      description: formatEntityChangeDescription(
        "aktiviteten",
        row.title,
        changes,
      ),
      actorName,
      businessAreaId: row.business_area_id,
      changes: { fields: changes },
    });
  }

  return mapActivityRow(row);
}
