import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGoalFormValues } from "./validateGoalForm";

const base = {
  businessAreaId: "area-1",
  title: "Nytt mål",
  description: "",
  ownerId: "",
  goalKind: "MEASURABLE",
  lifecycle: "ACTIVE",
  deadline: "",
  targetValue: "",
  currentValue: "",
  statusValue: "",
};

describe("parseGoalFormValues", () => {
  it("requires title, area and a valid kind", () => {
    assert.equal(
      parseGoalFormValues({ ...base, title: "  " }).ok,
      false,
    );
    assert.equal(
      parseGoalFormValues({ ...base, businessAreaId: "" }).ok,
      false,
    );
    assert.equal(
      parseGoalFormValues({ ...base, goalKind: "KPI" }).ok,
      false,
    );
  });

  it("ignores manual status for MEASURABLE and keeps values for auto-calc", () => {
    const result = parseGoalFormValues({
      ...base,
      goalKind: "MEASURABLE",
      currentValue: " 40 ",
      targetValue: "100",
      deadline: "2026-12-31",
      statusValue: "Röd",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.goalKind, "MEASURABLE");
    assert.equal(result.value.currentValue, "40");
    assert.equal(result.value.targetValue, "100");
    assert.equal(result.value.deadline, "2026-12-31");
    assert.equal(result.value.lifecycle, "ACTIVE");
  });

  it("clears measurable fields for ACTIVITY and defaults status to Gul", () => {
    const result = parseGoalFormValues({
      ...base,
      goalKind: "ACTIVITY",
      currentValue: "40",
      targetValue: "100",
      deadline: "2026-12-31",
      statusValue: "",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.goalKind, "ACTIVITY");
    assert.equal(result.value.currentValue, undefined);
    assert.equal(result.value.targetValue, undefined);
    assert.equal(result.value.deadline, undefined);
    assert.equal(result.value.status, "Gul");
  });

  it("accepts manual G/Y/R and DONE for ACTIVITY", () => {
    const result = parseGoalFormValues({
      ...base,
      goalKind: "ACTIVITY",
      statusValue: "Röd",
      lifecycle: "DONE",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.status, "Röd");
    assert.equal(result.value.lifecycle, "DONE");
  });

  it("rejects invalid lifecycle and ACTIVITY status", () => {
    assert.equal(
      parseGoalFormValues({ ...base, lifecycle: "ARCHIVED" }).ok,
      false,
    );
    assert.equal(
      parseGoalFormValues({
        ...base,
        goalKind: "ACTIVITY",
        statusValue: "Statistik",
      }).ok,
      false,
    );
  });
});
