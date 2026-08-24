import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { profileAssignmentLabel, toGoalOwnerOptions } from "./owner";

describe("profileAssignmentLabel", () => {
  it("prefers display_name and falls back to role label", () => {
    assert.equal(
      profileAssignmentLabel({ display_name: "  Lars-Olof  ", role: "ao_chef" }),
      "Lars-Olof",
    );
    assert.equal(
      profileAssignmentLabel({ display_name: "", role: "vd" }),
      "VD",
    );
    assert.equal(
      profileAssignmentLabel({ display_name: "   ", role: "administrator" }),
      "Administratör",
    );
  });
});

describe("toGoalOwnerOptions", () => {
  it("excludes disabled users and sorts by display name", () => {
    const options = toGoalOwnerOptions([
      {
        id: "2",
        display_name: "Peter",
        role: "vd",
        disabled_at: null,
      },
      {
        id: "3",
        display_name: "Anna",
        role: "ao_chef",
        disabled_at: null,
      },
      {
        id: "9",
        display_name: "Inaktiv",
        role: "ao_chef",
        disabled_at: "2026-08-01T00:00:00.000Z",
      },
    ]);
    assert.deepEqual(
      options.map((option) => option.id),
      ["3", "2"],
    );
  });
});
