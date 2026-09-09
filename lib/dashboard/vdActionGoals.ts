import {
  parseIsoCalendarDate,
  stockholmCalendarDate,
} from "@/lib/kpi/dailyReportDate";
import { isGoalDone } from "@/lib/goals/lifecycle";
import type { GoalLifecycle } from "@/types/goal";
import type { StatusTone } from "@/types/status";

/** Existing goals list in the app header / admin. */
export const VD_GOALS_VIEW_HREF = "/admin/goals";

export const VD_ACTION_GOAL_LIMIT = 5;

export const VD_ACTION_GOALS_EMPTY_MESSAGE =
  "Inga mål kräver åtgärd just nu.";

export type VdDashboardActionGoal = {
  id: string;
  goal: string;
  area: string;
  owner: string;
  deadline: string;
  deadlineDate?: string | null;
  status: StatusTone;
  lifecycle: GoalLifecycle;
};

export type VdDashboardActionGoalsResult<T extends VdDashboardActionGoal> = {
  items: T[];
  matchingCount: number;
  hasMore: boolean;
};

function addCalendarDays(isoDate: string, delta: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  const yyyy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function resolveDeadlineDate(goal: VdDashboardActionGoal): string | null {
  if (goal.deadlineDate) {
    return parseIsoCalendarDate(goal.deadlineDate);
  }
  if (!goal.deadline || goal.deadline === "—") {
    return null;
  }
  return parseIsoCalendarDate(goal.deadline.slice(0, 10));
}

export function isGoalOverdueForVd(
  deadlineDate: string | null,
  today: string,
): boolean {
  return deadlineDate != null && deadlineDate < today;
}

/** Inclusive today through +30 calendar days in Europe/Stockholm. */
export function isGoalDueSoonForVd(
  deadlineDate: string | null,
  today: string,
): boolean {
  if (deadlineDate == null) {
    return false;
  }
  const until = addCalendarDays(today, 30);
  return deadlineDate >= today && deadlineDate <= until;
}

/**
 * VD dashboard "Kräver åtgärd" goals: red, overdue, or deadline within 30 days.
 * Does not list every yellow goal. Grön is not done — only lifecycle DONE is.
 */
export function isVdDashboardActionGoal(
  goal: VdDashboardActionGoal,
  today: string,
): boolean {
  if (isGoalDone(goal)) {
    return false;
  }
  const deadlineDate = resolveDeadlineDate(goal);
  return (
    goal.status === "Röd" ||
    isGoalOverdueForVd(deadlineDate, today) ||
    isGoalDueSoonForVd(deadlineDate, today)
  );
}

function attentionRank(
  goal: VdDashboardActionGoal,
  today: string,
): number {
  if (goal.status === "Röd") {
    return 0;
  }
  const deadlineDate = resolveDeadlineDate(goal);
  if (isGoalOverdueForVd(deadlineDate, today)) {
    return 1;
  }
  return 2;
}

export function selectVdDashboardActionGoals<T extends VdDashboardActionGoal>(
  goals: T[] | null | undefined,
  options?: { now?: Date; limit?: number },
): VdDashboardActionGoalsResult<T> {
  const today = stockholmCalendarDate(options?.now ?? new Date());
  const limit = options?.limit ?? VD_ACTION_GOAL_LIMIT;
  const matching = [...(goals ?? [])]
    .filter((goal) => isVdDashboardActionGoal(goal, today))
    .sort((a, b) => {
      const rankDiff = attentionRank(a, today) - attentionRank(b, today);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      const aDate = resolveDeadlineDate(a) ?? "9999-12-31";
      const bDate = resolveDeadlineDate(b) ?? "9999-12-31";
      return aDate.localeCompare(bDate);
    });

  return {
    items: matching.slice(0, limit),
    matchingCount: matching.length,
    hasMore: matching.length > limit,
  };
}
