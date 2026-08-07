import {
  fetchAllGoals,
  fetchGoalById,
  fetchGoalsByBusinessAreaId,
  insertGoal,
  updateGoalRow,
} from "@/lib/supabase/goals";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { recordAuditLog } from "@/services/auditLog";
import {
  collectFieldChanges,
  formatEntityChangeDescription,
  formatEntityCreateDescription,
  resolveActorName,
  snapshotCreateChanges,
} from "@/services/changeHistory";
import type {
  CreateGoalInput,
  Goal,
  StatusTone,
  UpdateGoalInput,
} from "@/types";

const DEFAULT_ACTOR = "Peter Sagebrant";

const GOAL_TRACKED_FIELDS = [
  "title",
  "description",
  "owner",
  "status",
  "target_value",
  "current_value",
  "deadline",
  "progress",
  "business_area_id",
] as const;

function toStatusTone(value: string): StatusTone {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return "Gul";
}

function mapGoalRow(row: {
  id: string;
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  status: string;
  target_value: string | null;
  current_value: string | null;
  deadline: string | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
}): Goal {
  return {
    id: row.id,
    businessAreaId: row.business_area_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    status: toStatusTone(row.status),
    targetValue: row.target_value,
    currentValue: row.current_value,
    deadline: row.deadline,
    progress: row.progress,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type GoalListItem = Goal & {
  businessAreaName: string;
};

export async function getGoalsByBusinessAreaId(
  businessAreaId: string,
): Promise<Goal[]> {
  const rows = await fetchGoalsByBusinessAreaId(businessAreaId);
  return rows.map(mapGoalRow);
}

export async function getGoals(): Promise<GoalListItem[]> {
  const [rows, areas] = await Promise.all([
    fetchAllGoals(),
    fetchBusinessAreas(),
  ]);

  const areaNames = new Map(areas.map((area) => [area.id, area.name]));

  return rows.map((row) => ({
    ...mapGoalRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
  }));
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Titel är obligatorisk.");
  }

  if (!input.businessAreaId) {
    throw new Error("businessAreaId är obligatoriskt.");
  }

  const progress =
    input.progress === undefined
      ? null
      : Math.min(100, Math.max(0, Math.round(input.progress)));

  const payload = {
    business_area_id: input.businessAreaId,
    title,
    description: input.description?.trim() || null,
    owner: input.owner?.trim() || null,
    status: input.status,
    target_value: input.targetValue?.trim() || null,
    current_value: input.currentValue?.trim() || null,
    deadline: input.deadline || null,
    progress,
  };

  const row = await insertGoal(payload);

  const createChanges = snapshotCreateChanges(payload, GOAL_TRACKED_FIELDS);
  const actorName = await resolveActorName(
    input.owner?.trim() || DEFAULT_ACTOR,
  );
  await recordAuditLog({
    entityType: "goal",
    entityId: row.id,
    action: "created",
    description: formatEntityCreateDescription("målet", row.title),
    actorName,
    businessAreaId: row.business_area_id,
    changes: createChanges.length > 0 ? { fields: createChanges } : null,
  });

  return mapGoalRow(row);
}

export async function getGoalById(id: string): Promise<GoalListItem | null> {
  const row = await fetchGoalById(id);
  if (!row) {
    return null;
  }

  const areas = await fetchBusinessAreas();
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));

  return {
    ...mapGoalRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
  };
}

export async function updateGoal(input: UpdateGoalInput): Promise<Goal> {
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

  const existing = await fetchGoalById(input.id);
  if (!existing) {
    throw new Error("Målet hittades inte.");
  }

  const progress =
    input.progress === undefined
      ? null
      : Math.min(100, Math.max(0, Math.round(input.progress)));

  const next = {
    business_area_id: input.businessAreaId,
    title,
    description: input.description?.trim() || null,
    owner: input.owner?.trim() || null,
    status: input.status,
    target_value: input.targetValue?.trim() || null,
    current_value: input.currentValue?.trim() || null,
    deadline: input.deadline || null,
    progress,
  };

  const changes = collectFieldChanges(
    {
      business_area_id: existing.business_area_id,
      title: existing.title,
      description: existing.description,
      owner: existing.owner,
      status: existing.status,
      target_value: existing.target_value,
      current_value: existing.current_value,
      deadline: existing.deadline,
      progress: existing.progress,
    },
    next,
    GOAL_TRACKED_FIELDS,
  );

  const row = await updateGoalRow(input.id, {
    ...next,
    updated_at: new Date().toISOString(),
  });

  if (changes.length > 0) {
    const actorName = await resolveActorName(
      input.owner?.trim() || DEFAULT_ACTOR,
    );
    await recordAuditLog({
      entityType: "goal",
      entityId: row.id,
      action: "updated",
      description: formatEntityChangeDescription("målet", row.title, changes),
      actorName,
      businessAreaId: row.business_area_id,
      changes: { fields: changes },
    });
  }

  return mapGoalRow(row);
}
