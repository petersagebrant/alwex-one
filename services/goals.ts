import { isGoalArchived } from "@/lib/goals/archive";
import { computeMeasurableProgressAndStatus } from "@/lib/goals/autoCalc";
import { parseGoalKind } from "@/lib/goals/kind";
import { parseGoalLifecycle } from "@/lib/goals/lifecycle";
import type { GoalKind, GoalLifecycle } from "@/types/goal";
import { profileAssignmentLabel } from "@/lib/goals/owner";
import {
  fetchAllGoals,
  fetchGoalById,
  fetchGoalsByBusinessAreaId,
  insertGoal,
  updateGoalArchivedAt,
  updateGoalRow,
  type GoalRow,
} from "@/lib/supabase/goals";
import {
  fetchBusinessAreaById,
  fetchBusinessAreas,
} from "@/lib/supabase/business-areas";
import { fetchProfileById } from "@/lib/supabase/profiles";
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
  "owner_id",
  "goal_kind",
  "lifecycle",
  "status",
  "target_value",
  "current_value",
  "deadline",
  "progress",
  "business_area_id",
  "archived_at",
] as const;

function toStatusTone(value: string): StatusTone {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return "Gul";
}

function resolveMeasurableMetrics(input: {
  currentValue: string | null;
  targetValue: string | null;
  deadline: string | null;
  createdAt?: string | null;
  existing?: { progress: number | null; status: string };
}): { progress: number | null; status: StatusTone } {
  const result = computeMeasurableProgressAndStatus({
    currentValue: input.currentValue,
    targetValue: input.targetValue,
    deadline: input.deadline,
    createdAt: input.createdAt,
  });
  if (result.computed) {
    return { progress: result.progress, status: result.status };
  }
  if (input.existing) {
    return {
      progress: input.existing.progress,
      status: toStatusTone(input.existing.status),
    };
  }
  return { progress: null, status: "Gul" };
}

function mapGoalRow(row: GoalRow): Goal {
  return {
    id: row.id,
    businessAreaId: row.business_area_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    ownerId: row.owner_id,
    goalKind: parseGoalKind(row.goal_kind),
    lifecycle: parseGoalLifecycle(row.lifecycle),
    status: toStatusTone(row.status),
    targetValue: row.target_value,
    currentValue: row.current_value,
    deadline: row.deadline,
    progress: row.progress,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveOwnerFields(input: {
  ownerId?: string;
  owner?: string;
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

function buildGoalPayload(input: {
  businessAreaId: string;
  title: string;
  description?: string;
  ownerId: string | null;
  owner: string | null;
  goalKind: GoalKind;
  lifecycle: GoalLifecycle;
  status: StatusTone;
  targetValue?: string;
  currentValue?: string;
  deadline?: string;
  progress: number | null;
}) {
  const isActivity = input.goalKind === "ACTIVITY";
  return {
    business_area_id: input.businessAreaId,
    title: input.title,
    description: input.description?.trim() || null,
    owner: input.owner,
    owner_id: input.ownerId,
    goal_kind: input.goalKind,
    lifecycle: input.lifecycle,
    status: input.status,
    target_value: isActivity ? null : input.targetValue?.trim() || null,
    current_value: isActivity ? null : input.currentValue?.trim() || null,
    deadline: isActivity ? null : input.deadline || null,
    progress: isActivity ? null : input.progress,
  };
}

export type GoalListItem = Goal & {
  businessAreaName: string;
};

export async function getGoalsByBusinessAreaId(
  businessAreaId: string,
  options?: { includeArchived?: boolean },
): Promise<Goal[]> {
  const rows = await fetchGoalsByBusinessAreaId(businessAreaId, {
    includeArchived: options?.includeArchived ?? false,
  });
  return rows.map(mapGoalRow);
}

export async function getGoals(options?: {
  businessAreaId?: string;
  includeArchived?: boolean;
}): Promise<GoalListItem[]> {
  const includeArchived = options?.includeArchived ?? false;
  const [rows, areas] = await Promise.all([
    options?.businessAreaId
      ? fetchGoalsByBusinessAreaId(options.businessAreaId, { includeArchived })
      : fetchAllGoals({ includeArchived }),
    options?.businessAreaId
      ? fetchBusinessAreaById(options.businessAreaId).then((area) =>
          area ? [area] : [],
        )
      : fetchBusinessAreas(),
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

  const goalKind = parseGoalKind(input.goalKind);
  const lifecycle = parseGoalLifecycle(input.lifecycle);
  const ownerFields = await resolveOwnerFields(input);

  let status: StatusTone = "Gul";
  let progress: number | null = null;
  if (goalKind === "ACTIVITY") {
    status = input.status && (input.status === "Grön" || input.status === "Gul" || input.status === "Röd")
      ? input.status
      : "Gul";
  } else {
    const metrics = resolveMeasurableMetrics({
      currentValue: input.currentValue?.trim() || null,
      targetValue: input.targetValue?.trim() || null,
      deadline: input.deadline || null,
    });
    status = metrics.status;
    progress = metrics.progress;
  }

  const payload = buildGoalPayload({
    businessAreaId: input.businessAreaId,
    title,
    description: input.description,
    ownerId: ownerFields.ownerId,
    owner: ownerFields.owner,
    goalKind,
    lifecycle,
    status,
    targetValue: input.targetValue,
    currentValue: input.currentValue,
    deadline: input.deadline,
    progress,
  });

  const row = await insertGoal(payload);

  const createChanges = snapshotCreateChanges(payload, GOAL_TRACKED_FIELDS);
  const actorName = await resolveActorName(DEFAULT_ACTOR);
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

  const goalKind = parseGoalKind(input.goalKind);
  const lifecycle = parseGoalLifecycle(input.lifecycle);
  const ownerFields = await resolveOwnerFields(input);

  let status: StatusTone = "Gul";
  let progress: number | null = null;
  if (goalKind === "ACTIVITY") {
    status = input.status && (input.status === "Grön" || input.status === "Gul" || input.status === "Röd")
      ? input.status
      : "Gul";
  } else {
    const metrics = resolveMeasurableMetrics({
      currentValue: input.currentValue?.trim() || null,
      targetValue: input.targetValue?.trim() || null,
      deadline: input.deadline || null,
      createdAt: existing.created_at,
      existing: {
        progress: existing.progress,
        status: existing.status,
      },
    });
    status = metrics.status;
    progress = metrics.progress;
  }

  const next = buildGoalPayload({
    businessAreaId: input.businessAreaId,
    title,
    description: input.description,
    ownerId: ownerFields.ownerId,
    owner: ownerFields.owner,
    goalKind,
    lifecycle,
    status,
    targetValue: input.targetValue,
    currentValue: input.currentValue,
    deadline: input.deadline,
    progress,
  });

  const changes = collectFieldChanges(
    {
      business_area_id: existing.business_area_id,
      title: existing.title,
      description: existing.description,
      owner: existing.owner,
      owner_id: existing.owner_id,
      goal_kind: existing.goal_kind,
      lifecycle: existing.lifecycle,
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
    const actorName = await resolveActorName(DEFAULT_ACTOR);
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

export async function archiveGoal(id: string): Promise<GoalListItem> {
  const existing = await fetchGoalById(id);
  if (!existing) {
    throw new Error("Målet hittades inte.");
  }
  if (existing.archived_at) {
    throw new Error("Målet är redan arkiverat.");
  }

  const row = await updateGoalArchivedAt(id, new Date().toISOString());
  const areas = await fetchBusinessAreas();
  const areaName =
    areas.find((area) => area.id === row.business_area_id)?.name ??
    "Okänt område";

  const actorName = await resolveActorName(DEFAULT_ACTOR);
  await recordAuditLog({
    entityType: "goal",
    entityId: row.id,
    action: "updated",
    description: `Målet "${row.title}" arkiverades (${areaName}).`,
    actorName,
    businessAreaId: row.business_area_id,
    changes: {
      fields: [
        {
          field: "archived_at",
          from: null,
          to: row.archived_at,
        },
      ],
    },
  });

  return {
    ...mapGoalRow(row),
    businessAreaName: areaName,
  };
}

export async function unarchiveGoal(id: string): Promise<GoalListItem> {
  const existing = await fetchGoalById(id);
  if (!existing) {
    throw new Error("Målet hittades inte.");
  }
  if (!existing.archived_at) {
    throw new Error("Målet är redan aktivt.");
  }

  const row = await updateGoalArchivedAt(id, null);
  const areas = await fetchBusinessAreas();
  const areaName =
    areas.find((area) => area.id === row.business_area_id)?.name ??
    "Okänt område";

  const actorName = await resolveActorName(DEFAULT_ACTOR);
  await recordAuditLog({
    entityType: "goal",
    entityId: row.id,
    action: "updated",
    description: `Målet "${row.title}" återaktiverades (${areaName}).`,
    actorName,
    businessAreaId: row.business_area_id,
    changes: {
      fields: [
        {
          field: "archived_at",
          from: existing.archived_at,
          to: null,
        },
      ],
    },
  });

  return {
    ...mapGoalRow(row),
    businessAreaName: areaName,
  };
}

export { isGoalArchived };
