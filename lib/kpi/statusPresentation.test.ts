import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STATISTIC_STATUS } from "./kind";
import { resolveKpiStatusPresentation } from "./statusPresentation";

describe("resolveKpiStatusPresentation", () => {
  it("shows Rapporterad for STATISTIC with a numeric value", () => {
    assert.deepEqual(
      resolveKpiStatusPresentation({
        kind: "STATISTIC",
        status: STATISTIC_STATUS,
        currentValue: "1200",
      }),
      { kind: "rapporterad" },
    );
  });

  it("shows Ej rapporterad for STATISTIC without a value", () => {
    assert.deepEqual(
      resolveKpiStatusPresentation({
        kind: "STATISTIC",
        status: STATISTIC_STATUS,
        currentValue: null,
      }),
      { kind: "ej_rapporterad" },
    );
    assert.deepEqual(
      resolveKpiStatusPresentation({
        kind: "STATISTIC",
        status: STATISTIC_STATUS,
        currentValue: "—",
      }),
      { kind: "ej_rapporterad" },
    );
  });

  it("keeps Beräknad for CALCULATED (e.g. Kr per mil)", () => {
    assert.deepEqual(
      resolveKpiStatusPresentation({
        kind: "CALCULATED",
        status: STATISTIC_STATUS,
        currentValue: "42,5",
      }),
      { kind: "beraknad" },
    );
    assert.deepEqual(
      resolveKpiStatusPresentation({
        kind: "CALCULATED",
        status: STATISTIC_STATUS,
        currentValue: null,
      }),
      { kind: "beraknad" },
    );
  });

  it("keeps G/Y/R for TARGET with value (incl. RATIO_PERCENT Sjukfrånvaro)", () => {
    assert.deepEqual(
      resolveKpiStatusPresentation({
        kind: "TARGET",
        status: "Grön",
        currentValue: "3,2",
      }),
      { kind: "tone", status: "Grön" },
    );
  });

  it("shows Ej rapporterad for TARGET without a value", () => {
    assert.deepEqual(
      resolveKpiStatusPresentation({
        kind: "TARGET",
        status: "Gul",
        currentValue: null,
      }),
      { kind: "ej_rapporterad" },
    );
  });
});
