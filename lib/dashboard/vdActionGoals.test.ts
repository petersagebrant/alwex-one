import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GoalLifecycle } from "@/types/goal";
import type { StatusTone } from "@/types/status";
import {
  isVdDashboardActionGoal,
  selectVdDashboardActionGoals,
  VD_ACTION_GOAL_LIMIT,
  VD_ACTION_GOALS_EMPTY_MESSAGE,
  VD_GOALS_VIEW_HREF,
  type VdDashboardActionGoal,
} from "./vdActionGoals";

const NOW = new Date("2026-09-09T12:00:00+02:00");
const TODAY = "2026-09-09";

function goal(overrides: Partial<VdDashboardActionGoal> & { id: string }): VdDashboardActionGoal {
  return {
    goal: overrides.goal ?? overrides.id,
    area: "Lager",
    owner: "Anna",
    deadline: overrides.deadline ?? "—",
    deadlineDate: overrides.deadlineDate ?? null,
    status: overrides.status ?? "Gul",
    lifecycle: overrides.lifecycle ?? "ACTIVE",
    ...overrides,
  };
}

function select(goals: VdDashboardActionGoal[]) {
  return selectVdDashboardActionGoals(goals, { now: NOW });
}

describe("VD dashboard action-goal filter", () => {
  it("keeps red ACTIVE goals even without a deadline", () => {
    const red = goal({
      id: "red",
      status: "Röd",
      deadline: "—",
      deadlineDate: null,
    });
    assert.equal(isVdDashboardActionGoal(red, TODAY), true);
    assert.deepEqual(
      select([red]).items.map((row) => row.id),
      ["red"],
    );
  });

  it("does not list yellow goals that are not overdue or due within 30 days", () => {
    const yellowFar = goal({
      id: "yellow-far",
      status: "Gul",
      deadline: "2026-12-01",
      deadlineDate: "2026-12-01",
    });
    const yellowNoDate = goal({
      id: "yellow-none",
      status: "Gul",
      deadline: "—",
      deadlineDate: null,
    });
    assert.equal(isVdDashboardActionGoal(yellowFar, TODAY), false);
    assert.equal(isVdDashboardActionGoal(yellowNoDate, TODAY), false);
    assert.equal(select([yellowFar, yellowNoDate]).matchingCount, 0);
  });

  it("keeps overdue ACTIVE goals and does not treat Grön as done", () => {
    const greenOverdue = goal({
      id: "green-overdue",
      status: "Grön",
      lifecycle: "ACTIVE",
      deadline: "2026-09-08",
      deadlineDate: "2026-09-08",
    });
    const yellowOverdue = goal({
      id: "yellow-overdue",
      status: "Gul",
      deadline: "2026-08-01",
      deadlineDate: "2026-08-01",
    });
    assert.equal(isVdDashboardActionGoal(greenOverdue, TODAY), true);
    assert.equal(isVdDashboardActionGoal(yellowOverdue, TODAY), true);
  });

  it("keeps deadlines from today through +30 Stockholm calendar days, exclusive of +31", () => {
    const dueToday = goal({
      id: "today",
      status: "Gul",
      deadlineDate: "2026-09-09",
      deadline: "2026-09-09",
    });
    const duePlus30 = goal({
      id: "plus30",
      status: "Gul",
      deadlineDate: "2026-10-09",
      deadline: "2026-10-09",
    });
    const duePlus31 = goal({
      id: "plus31",
      status: "Gul",
      deadlineDate: "2026-10-10",
      deadline: "2026-10-10",
    });
    assert.equal(isVdDashboardActionGoal(dueToday, TODAY), true);
    assert.equal(isVdDashboardActionGoal(duePlus30, TODAY), true);
    assert.equal(isVdDashboardActionGoal(duePlus31, TODAY), false);
  });

  it("excludes DONE even when red or past deadline (Grön is not Klart)", () => {
    const doneRed: VdDashboardActionGoal = goal({
      id: "done-red",
      status: "Röd",
      lifecycle: "DONE" as GoalLifecycle,
      deadlineDate: "2026-01-01",
      deadline: "2026-01-01",
    });
    const doneOverdue = goal({
      id: "done-overdue",
      status: "Gul" as StatusTone,
      lifecycle: "DONE",
      deadlineDate: "2026-01-01",
      deadline: "2026-01-01",
    });
    assert.equal(isVdDashboardActionGoal(doneRed, TODAY), false);
    assert.equal(isVdDashboardActionGoal(doneOverdue, TODAY), false);
  });

  it("orders red, then overdue, then due-soon, and caps the dashboard at 5", () => {
    const goals: VdDashboardActionGoal[] = [
      goal({
        id: "soon-b",
        status: "Gul",
        deadlineDate: "2026-09-20",
        deadline: "2026-09-20",
      }),
      goal({
        id: "overdue-b",
        status: "Gul",
        deadlineDate: "2026-09-01",
        deadline: "2026-09-01",
      }),
      goal({
        id: "red-no-date",
        status: "Röd",
        deadlineDate: null,
        deadline: "—",
      }),
      goal({
        id: "soon-a",
        status: "Grön",
        deadlineDate: "2026-09-15",
        deadline: "2026-09-15",
      }),
      goal({
        id: "overdue-a",
        status: "Grön",
        deadlineDate: "2026-08-01",
        deadline: "2026-08-01",
      }),
      goal({
        id: "red-soon",
        status: "Röd",
        deadlineDate: "2026-09-12",
        deadline: "2026-09-12",
      }),
      goal({
        id: "yellow-far",
        status: "Gul",
        deadlineDate: "2027-01-01",
        deadline: "2027-01-01",
      }),
    ];

    const result = select(goals);
    assert.equal(result.matchingCount, 6);
    assert.equal(result.hasMore, true);
    assert.equal(result.items.length, VD_ACTION_GOAL_LIMIT);
    assert.deepEqual(
      result.items.map((row) => row.id),
      ["red-soon", "red-no-date", "overdue-a", "overdue-b", "soon-a"],
    );
  });

  it("does not show a more-link when 5 or fewer match", () => {
    const result = select([
      goal({
        id: "only-red",
        status: "Röd",
        deadlineDate: null,
      }),
    ]);
    assert.equal(result.hasMore, false);
    assert.equal(result.matchingCount, 1);
  });

  it("exposes the existing goals route and compact empty copy", () => {
    assert.equal(VD_GOALS_VIEW_HREF, "/admin/goals");
    assert.equal(
      VD_ACTION_GOALS_EMPTY_MESSAGE,
      "Inga mål kräver åtgärd just nu.",
    );
    assert.equal(select([]).matchingCount, 0);
    assert.equal(select([]).items.length, 0);
  });
});
