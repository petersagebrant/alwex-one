import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeKpiStatus,
  validateGreenYellowTolerances,
} from "./computeStatus";
import { shouldWriteKpiMeasurementHistory } from "./shouldWriteMeasurementHistory";

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

    it("ignores greenTolerance (functionally unchanged)", () => {
      assert.equal(
        computeKpiStatus({ ...base, value: 95, greenTolerance: 0 }),
        "Gul",
      );
      assert.equal(
        computeKpiStatus({ ...base, value: 100, greenTolerance: 50 }),
        "Grön",
      );
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
      // Resultat mot budget: +0,6 Mkr is on the good side of target 0
      assert.equal(computeKpiStatus({ ...base, value: "0,6" }), "Grön");
    });

    it("yellow when within absolute band below target", () => {
      assert.equal(computeKpiStatus({ ...base, value: -0.1 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: -0.2 }), "Gul");
    });

    it("red when worse than yellow band", () => {
      assert.equal(computeKpiStatus({ ...base, value: -0.3 }), "Röd");
    });
  });

  describe("Resultat mot budget (HIGHER_IS_BETTER, target 0 Mkr)", () => {
    const base = {
      direction: "HIGHER_IS_BETTER" as const,
      toleranceType: "ABSOLUTE" as const,
      yellowTolerance: 0.2,
      target: 0,
    };

    it("treats positive and zero as green", () => {
      assert.equal(computeKpiStatus({ ...base, value: "0,6" }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 0 }), "Grön");
    });

    it("uses yellow band for small negative deviation", () => {
      assert.equal(computeKpiStatus({ ...base, value: "-0,1" }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: -0.2 }), "Gul");
    });

    it("marks larger negative deviation red", () => {
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

    it("ignores greenTolerance", () => {
      assert.equal(
        computeKpiStatus({ ...base, value: 105, greenTolerance: 0 }),
        "Gul",
      );
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

  describe("TARGET_IS_BEST PERCENT with green NULL (tiny compat)", () => {
    const base = {
      direction: "TARGET_IS_BEST" as const,
      toleranceType: "PERCENT" as const,
      yellowTolerance: 5,
      target: 100,
      greenTolerance: null,
    };

    it("green near exact via tiny heuristic", () => {
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

  describe("TARGET_IS_BEST ABSOLUTE with green NULL (tiny compat)", () => {
    const base = {
      direction: "TARGET_IS_BEST" as const,
      toleranceType: "ABSOLUTE" as const,
      yellowTolerance: 2,
      target: 0,
      greenTolerance: null,
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

  describe("TARGET_IS_BEST ABSOLUTE with dual green/yellow", () => {
    const base = {
      direction: "TARGET_IS_BEST" as const,
      toleranceType: "ABSOLUTE" as const,
      greenTolerance: 0.5,
      yellowTolerance: 1.5,
      target: 5,
    };

    it("exact green boundary (≤ green)", () => {
      assert.equal(computeKpiStatus({ ...base, value: 5 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 5.5 }), "Grön"); // |0.5|
      assert.equal(computeKpiStatus({ ...base, value: 4.5 }), "Grön");
    });

    it("just over green → yellow", () => {
      assert.equal(computeKpiStatus({ ...base, value: 5.51 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 4.49 }), "Gul");
    });

    it("exact yellow boundary (≤ yellow)", () => {
      assert.equal(computeKpiStatus({ ...base, value: 6.5 }), "Gul"); // |1.5|
      assert.equal(computeKpiStatus({ ...base, value: 3.5 }), "Gul");
    });

    it("just over yellow → red", () => {
      assert.equal(computeKpiStatus({ ...base, value: 6.51 }), "Röd");
      assert.equal(computeKpiStatus({ ...base, value: 3.49 }), "Röd");
    });

    it("symmetric ± deviations", () => {
      assert.equal(computeKpiStatus({ ...base, value: 5.2 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 4.8 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 6 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 4 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 7 }), "Röd");
      assert.equal(computeKpiStatus({ ...base, value: 3 }), "Röd");
    });

    it("does not use tiny heuristic when green is set", () => {
      // Without green, tiny = 0.015; with green=0.5, value 0.1 from target is green
      assert.equal(
        computeKpiStatus({
          ...base,
          yellowTolerance: 1.5,
          greenTolerance: 0.5,
          value: 5.1,
        }),
        "Grön",
      );
      // Same deviation with green NULL would be yellow (tiny=0.015)
      assert.equal(
        computeKpiStatus({
          ...base,
          greenTolerance: null,
          value: 5.1,
        }),
        "Gul",
      );
    });
  });

  describe("TARGET_IS_BEST ABSOLUTE target=0 and percentage points", () => {
    it("target=0 works with absolute deviation", () => {
      const base = {
        direction: "TARGET_IS_BEST" as const,
        toleranceType: "ABSOLUTE" as const,
        greenTolerance: 0.2,
        yellowTolerance: 0.5,
        target: 0,
      };
      assert.equal(computeKpiStatus({ ...base, value: 0 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 0.2 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: -0.2 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 0.21 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: -0.5 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 0.51 }), "Röd");
    });

    it("ABSOLUTE + unit % = percentage points from target", () => {
      // KPI unit is %; target 4.5%, green 0.5 pp, yellow 1.5 pp
      const base = {
        direction: "TARGET_IS_BEST" as const,
        toleranceType: "ABSOLUTE" as const,
        greenTolerance: 0.5,
        yellowTolerance: 1.5,
        target: 4.5,
      };
      assert.equal(computeKpiStatus({ ...base, value: 4.5 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 5.0 }), "Grön"); // 0.5 pp
      assert.equal(computeKpiStatus({ ...base, value: 4.0 }), "Grön");
      assert.equal(computeKpiStatus({ ...base, value: 5.1 }), "Gul"); // 0.6 pp
      assert.equal(computeKpiStatus({ ...base, value: 6.0 }), "Gul"); // 1.5 pp
      assert.equal(computeKpiStatus({ ...base, value: 6.1 }), "Röd"); // 1.6 pp
    });
  });

  describe("TARGET_IS_BEST PERCENT with explicit green", () => {
    const base = {
      direction: "TARGET_IS_BEST" as const,
      toleranceType: "PERCENT" as const,
      greenTolerance: 1,
      yellowTolerance: 5,
      target: 100,
    };

    it("exact / just over green and yellow", () => {
      assert.equal(computeKpiStatus({ ...base, value: 101 }), "Grön"); // 1%
      assert.equal(computeKpiStatus({ ...base, value: 101.1 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 105 }), "Gul");
      assert.equal(computeKpiStatus({ ...base, value: 105.1 }), "Röd");
    });
  });
});

describe("validateGreenYellowTolerances", () => {
  it("accepts null green with yellow", () => {
    assert.equal(validateGreenYellowTolerances(null, 5), null);
    assert.equal(validateGreenYellowTolerances(undefined, 5), null);
  });

  it("accepts green ≤ yellow", () => {
    assert.equal(validateGreenYellowTolerances(0.5, 1.5), null);
    assert.equal(validateGreenYellowTolerances(1, 1), null);
    assert.equal(validateGreenYellowTolerances(0, 0), null);
  });

  it("rejects green > yellow", () => {
    assert.match(
      validateGreenYellowTolerances(2, 1) ?? "",
      /Grön tolerans/,
    );
  });

  it("rejects negative values", () => {
    assert.match(validateGreenYellowTolerances(-1, 5) ?? "", /grön/i);
    assert.match(validateGreenYellowTolerances(1, -5) ?? "", /gul/i);
  });
});

describe("metadata must not write kpi_history", () => {
  it("green/yellow tolerance changes alone do not write history", () => {
    assert.equal(
      shouldWriteKpiMeasurementHistory([
        { field: "green_tolerance" },
        { field: "yellow_tolerance" },
        { field: "status" },
      ]),
      false,
    );
  });

  it("only current_value triggers history", () => {
    assert.equal(
      shouldWriteKpiMeasurementHistory([{ field: "current_value" }]),
      true,
    );
  });
});
