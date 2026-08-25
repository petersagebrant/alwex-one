import type { GoalLifecycle } from "@/types/goal";
import type { StatusTone } from "@/types/status";

export type { GoalLifecycle };

export const GOAL_LIFECYCLE_LABELS: Record<GoalLifecycle, string> = {
  ACTIVE: "Aktivt",
  DONE: "Klart",
};

export function isGoalLifecycle(
  value: string | null | undefined,
): value is GoalLifecycle {
  return value === "ACTIVE" || value === "DONE";
}

export function parseGoalLifecycle(
  value: string | null | undefined,
): GoalLifecycle {
  return value === "DONE" ? "DONE" : "ACTIVE";
}

/** Dashboard "Klara mål" — DONE, never Grön. */
export function isGoalDone(goal: { lifecycle: GoalLifecycle }): boolean {
  return goal.lifecycle === "DONE";
}

/** "Mål som kräver åtgärd": still in play and off pace. */
export function isGoalNeedingAction(goal: {
  lifecycle: GoalLifecycle;
  status: StatusTone;
}): boolean {
  return (
    goal.lifecycle === "ACTIVE" &&
    (goal.status === "Gul" || goal.status === "Röd")
  );
}
