import type { GoalKind } from "@/types/goal";

export type { GoalKind };

export const GOAL_KIND_LABELS: Record<GoalKind, string> = {
  MEASURABLE: "Mätbart mål",
  ACTIVITY: "Aktivitets-/projektmål",
};

export function isGoalKind(value: string | null | undefined): value is GoalKind {
  return value === "MEASURABLE" || value === "ACTIVITY";
}

export function parseGoalKind(value: string | null | undefined): GoalKind {
  return value === "ACTIVITY" ? "ACTIVITY" : "MEASURABLE";
}

export function isMeasurableGoal(goal: { goalKind: GoalKind }): boolean {
  return goal.goalKind === "MEASURABLE";
}

export function isActivityGoal(goal: { goalKind: GoalKind }): boolean {
  return goal.goalKind === "ACTIVITY";
}
