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
} from "@/lib/supabase/activities";
import {
  fetchAllGoals,
  fetchGoalsByBusinessAreaId,
} from "@/lib/supabase/goals";
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
  "status",
  "priority",
  "deadline",
  "completed_at",
  "business_area_id",
  "goal_id",
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

function mapActivityRow(row: {
  id: string;
  business_area_id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  owner: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}): Activity {
  return {
    id: row.id,
    businessAreaId: row.business_area_id,
    goalId: row.goal_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    status: toStatus(row.status),
    priority: toPriority(row.priority),
    deadline: row.deadline,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

  const payload = {
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

  const row = await insertActivity(payload);

  const createChanges = snapshotCreateChanges(payload, ACTIVITY_TRACKED_FIELDS);
  const actorName = await resolveActorName(
    input.owner?.trim() || DEFAULT_ACTOR,
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
