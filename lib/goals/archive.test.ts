import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activeGoalsOnly, isGoalArchived } from "./archive";

describe("isGoalArchived", () => {
  it("treats null archivedAt as active", () => {
    assert.equal(isGoalArchived({ archivedAt: null }), false);
  });

  it("treats timestamp as archived", () => {
    assert.equal(
      isGoalArchived({ archivedAt: "2026-08-24T10:00:00.000Z" }),
      true,
    );
  });
});

describe("activeGoalsOnly", () => {
  it("drops archived goals from operational lists", () => {
    const goals = [
      { id: "keep", archivedAt: null, status: "Röd" as const },
      {
        id: "hidden",
        archivedAt: "2026-08-24T10:00:00.000Z",
        status: "Röd" as const,
      },
    ];
    assert.deepEqual(
      activeGoalsOnly(goals).map((goal) => goal.id),
      ["keep"],
    );
  });
});
