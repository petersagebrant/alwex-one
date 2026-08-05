import {
  fetchAllGoals,
  fetchGoalsByBusinessAreaId,
  insertGoal,
} from "@/lib/supabase/goals";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { recordAuditLog } from "@/services/auditLog";
import type { CreateGoalInput, Goal, StatusTone } from "@/types";

const DEFAULT_ACTOR = "Peter Sagebrant";

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

  const row = await insertGoal({
    business_area_id: input.businessAreaId,
    title,
    description: input.description?.trim() || null,
    owner: input.owner?.trim() || null,
    status: input.status,
    target_value: input.targetValue?.trim() || null,
    current_value: input.currentValue?.trim() || null,
    deadline: input.deadline || null,
    progress,
  });

  await recordAuditLog({
    entityType: "goal",
    entityId: row.id,
    action: "created",
    description: `Skapade målet "${row.title}"`,
    actorName: input.owner?.trim() || DEFAULT_ACTOR,
    businessAreaId: row.business_area_id,
  });

  return mapGoalRow(row);
}
