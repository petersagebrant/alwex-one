import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasValidRatioInputs,
  orderRatioKpisByWeightedInputs,
  resolvePeriodKpiValue,
} from "./sjukfranvaroAreas";

describe("orderRatioKpisByWeightedInputs", () => {
  it("orders AO KPIs by weighted sort_order, not by value or name", () => {
    const ratioKpis = [
      {
        id: "pct-b",
        businessAreaId: "b",
        calcNumeratorKpiId: "n-b",
        calcDenominatorKpiId: "d-b",
      },
      {
        id: "pct-a",
        businessAreaId: "a",
        calcNumeratorKpiId: "n-a",
        calcDenominatorKpiId: "d-a",
      },
      {
        id: "pct-c",
        businessAreaId: "c",
        calcNumeratorKpiId: "n-c",
        calcDenominatorKpiId: "d-c",
      },
    ];
    const weighted = [
      { numeratorKpiId: "n-a", denominatorKpiId: "d-a", sortOrder: 1 },
      { numeratorKpiId: "n-b", denominatorKpiId: "d-b", sortOrder: 2 },
      { numeratorKpiId: "n-c", denominatorKpiId: "d-c", sortOrder: 3 },
    ];

    assert.deepEqual(
      orderRatioKpisByWeightedInputs(ratioKpis, weighted).map((k) => k.id),
      ["pct-a", "pct-b", "pct-c"],
    );
  });

  it("omits ratio KPIs that are not in the weighted config", () => {
    const ratioKpis = [
      {
        id: "extra",
        businessAreaId: "x",
        calcNumeratorKpiId: "n-x",
        calcDenominatorKpiId: "d-x",
      },
      {
        id: "pct-a",
        businessAreaId: "a",
        calcNumeratorKpiId: "n-a",
        calcDenominatorKpiId: "d-a",
      },
    ];
    const weighted = [
      { numeratorKpiId: "n-a", denominatorKpiId: "d-a", sortOrder: 1 },
    ];

    assert.deepEqual(
      orderRatioKpisByWeightedInputs(ratioKpis, weighted).map((k) => k.id),
      ["pct-a"],
    );
  });

  it("returns empty when no weighted inputs", () => {
    const ratioKpis = [
      {
        id: "pct-a",
        businessAreaId: "a",
        calcNumeratorKpiId: "n-a",
        calcDenominatorKpiId: "d-a",
      },
    ];
    assert.deepEqual(orderRatioKpisByWeightedInputs(ratioKpis, []), []);
  });
});

describe("resolvePeriodKpiValue", () => {
  it("prefers history for the report period over current_value", () => {
    assert.equal(resolvePeriodKpiValue("32", "99"), "32");
  });

  it("falls back to current_value when period history is missing", () => {
    assert.equal(resolvePeriodKpiValue(null, "32"), "32");
    assert.equal(resolvePeriodKpiValue("  ", "80"), "80");
    assert.equal(resolvePeriodKpiValue(undefined, "1000"), "1000");
  });

  it("returns null when both history and current are empty", () => {
    assert.equal(resolvePeriodKpiValue(null, null), null);
    assert.equal(resolvePeriodKpiValue("", "  "), null);
  });
});

describe("hasValidRatioInputs", () => {
  it("matches weighted-total valid-input rule (numeric, den ≠ 0)", () => {
    assert.equal(hasValidRatioInputs("32", "1000"), true);
    assert.equal(hasValidRatioInputs("80", "1000"), true);
    assert.equal(hasValidRatioInputs("32", null), false);
    assert.equal(hasValidRatioInputs(null, "1000"), false);
    assert.equal(hasValidRatioInputs("32", "0"), false);
    assert.equal(hasValidRatioInputs("", ""), false);
  });
});
