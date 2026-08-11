import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeKpiStatus } from "./computeStatus";

describe("computeKpiStatus", () => {
  it("returns null when direction is missing (manual path)", () => {
    assert.equal(
      computeKpiStatus({
        direction: null,
        toleranceType: "PERCENT",
        yellowTolerance: 5,
        value: 10,
        target: 10,
      }),
      null,
    );
  });

  it("returns null for unparseable numbers", () => {
    assert.equal(
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "PERCENT",
        yellowTolerance: 5,
        value: "abc",
        target: 10,
      }),
      null,
    );
  });

  it("returns null when yellowTolerance missing", () => {
    assert.equal(
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        yellowTolerance: null,
        value: 1,
        target: 2,
      }),
      null,
    );
  });

  describe("HIGHER_IS_BETTER PERCENT", () => {
    const base = {
      direction: "HIGHER_IS_BETTER" as const,
      toleranceType: "PERCENT" as const,
      yellowTolerance: 10,
      target: 100,
    };

    it("green when value >= target", () => {
      assert.equal(computeKpiStatus({ ...base, value: 100 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 105 }), "Grön");
    });

    it("yellow within band below target", () => {
      // 5% below → yellow
      assert.equal(computeKpiStatus({ ...base, value: 95 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 90 }), "Gul");
    });

    it("red beyond yellow band", () => {
      assert.equal(computeKpiStatus({ ...base, value: 89 }), "Röd");
    });

    it("accepts Swedish comma values", () => {
      assert.equal(computeKpiStatus({ ...base, value: "95,5" }), "Gul");
    });
  });

  describe("HIGHER_IS_BETTER ABSOLUTE (target ≈ 0)", () => {
    const base = {
      direction: "HIGHER_IS_BETTER" as const,
      toleranceType: "ABSOLUTE" as const,
      yellowTolerance: 0.2,
      target: 0,
    };

    it("green when value >= 0", () => {
      assert.equal(computeKpiStatus({ ...base, value: 0 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 0.1 }), "Grön");
    });

    it("yellow when within absolute band below target", () => {
      assert.equal(computeKpiStatus({ ...base, value: -0.1 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: -0.2 }), "Gul");
    });

    it("red when worse than yellow band", () => {
      assert.equal(computeKpiStatus({ ...base, value: -0.3 }), "Röd");
    });
  });

  describe("LOWER_IS_BETTER PERCENT", () => {
    const base = {
      direction: "LOWER_IS_BETTER" as const,
      toleranceType: "PERCENT" as const,
      yellowTolerance: 10,
      target: 100,
    };

    it("green when value <= target", () => {
      assert.equal(computeKpiStatus({ ...base, value: 100 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 90 }), "Grön");
    });

    it("yellow when slightly above target", () => {
      assert.equal(computeKpiStatus({ ...base, value: 105 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 110 }), "Gul");
    });

    it("red beyond yellow band", () => {
      assert.equal(computeKpiStatus({ ...base, value: 111 }), "Röd");
    });
  });

  describe("LOWER_IS_BETTER ABSOLUTE", () => {
    const base = {
      direction: "LOWER_IS_BETTER" as const,
      toleranceType: "ABSOLUTE" as const,
      yellowTolerance: 2,
      target: 10,
    };

    it("green / yellow / red", () => {
      assert.equal(computeKpiStatus({ ...base, value: 9 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 11 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 12 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 13 }), "Röd");
    });
  });

  describe("TARGET_IS_BEST PERCENT", () => {
    const base = {
      direction: "TARGET_IS_BEST" as const,
      toleranceType: "PERCENT" as const,
      yellowTolerance: 5,
      target: 100,
    };

    it("green near exact", () => {
      assert.equal(computeKpiStatus({ ...base, value: 100 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 100.4 }), "Grön"); // 0.4% <= 0.5
    });

    it("yellow within yellowTolerance", () => {
      assert.equal(computeKpiStatus({ ...base, value: 97 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 104 }), "Gul");
    });

    it("red beyond yellowTolerance", () => {
      assert.equal(computeKpiStatus({ ...base, value: 94 }), "Röd");
    });
  });

  describe("TARGET_IS_BEST ABSOLUTE", () => {
    const base = {
      direction: "TARGET_IS_BEST" as const,
      toleranceType: "ABSOLUTE" as const,
      yellowTolerance: 2,
      target: 0,
    };

    it("green near exact (tiny band = 1% of yellow)", () => {
      assert.equal(computeKpiStatus({ ...base, value: 0 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 0.01 }), "Grön"); // |0.01| <= 0.02
    });

    it("yellow within absolute band", () => {
      assert.equal(computeKpiStatus({ ...base, value: 1 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: -2 }), "Gul");
    });

    it("red beyond band", () => {
      assert.equal(computeKpiStatus({ ...base, value: 2.1 }), "Röd");
    });
  });
});
