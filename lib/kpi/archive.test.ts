import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isKpiArchived } from "./archive";

describe("isKpiArchived", () => {
  it("treats null archivedAt as active", () => {
    assert.equal(isKpiArchived({ archivedAt: null }), false);
  });

  it("treats timestamp as archived", () => {
    assert.equal(
      isKpiArchived({ archivedAt: "2026-08-14T10:00:00.000Z" }),
      true,
    );
  });
});
