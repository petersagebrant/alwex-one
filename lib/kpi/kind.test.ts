import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countTargetKpiStatuses,
  isStatisticKpi,
  parseKpiKind,
  parseKpiStoredStatus,
  STATISTIC_STATUS,
  targetKpisOnly,
} from "./kind";

describe("kpi kind helpers", () => {
  it("parses kind defaults to TARGET", () => {
    assert.equal(parseKpiKind(null), "TARGET");
    assert.equal(parseKpiKind("STATISTIC"), "STATISTIC");
  });

  it("does not coerce Statistik status to Gul", () => {
    assert.equal(parseKpiStoredStatus("Statistik"), STATISTIC_STATUS);
    assert.equal(parseKpiStoredStatus("Grön"), "Grön");
    assert.equal(parseKpiStoredStatus("unknown"), "Gul");
  });

  it("excludes statistics from G/Y/R counts", () => {
    const kpis = [
      { kind: "TARGET" as const, status: "Grön" as const },
      { kind: "TARGET" as const, status: "Gul" as const },
      { kind: "STATISTIC" as const, status: STATISTIC_STATUS },
      { kind: "TARGET" as const, status: "Röd" as const },
    ];
    assert.deepEqual(countTargetKpiStatuses(kpis), {
      Grön: 1,
      Gul: 1,
      Röd: 1,
    });
    assert.equal(targetKpisOnly(kpis).length, 3);
    assert.equal(isStatisticKpi(kpis[2]), true);
  });
});
