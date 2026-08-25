import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGoalDone, isGoalNeedingAction, parseGoalLifecycle } from "./lifecycle";

describe("goal lifecycle", () => {
  it("treats DONE as Klart, not Grön", () => {
    assert.equal(isGoalDone({ lifecycle: "DONE" }), true);
    assert.equal(isGoalDone({ lifecycle: "ACTIVE" }), false);
    assert.equal(parseGoalLifecycle(undefined), "ACTIVE");
    assert.equal(parseGoalLifecycle("DONE"), "DONE");
  });

  it("requires ACTIVE plus Gul/Röd for action items", () => {
    assert.equal(
      isGoalNeedingAction({ lifecycle: "ACTIVE", status: "Gul" }),
      true,
    );
    assert.equal(
      isGoalNeedingAction({ lifecycle: "ACTIVE", status: "Röd" }),
      true,
    );
    assert.equal(
      isGoalNeedingAction({ lifecycle: "ACTIVE", status: "Grön" }),
      false,
    );
    assert.equal(
      isGoalNeedingAction({ lifecycle: "DONE", status: "Gul" }),
      false,
    );
    assert.equal(
      isGoalNeedingAction({ lifecycle: "DONE", status: "Grön" }),
      false,
    );
  });
});
