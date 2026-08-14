import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countTargetKpiStatuses,
  isCalculatedKpi,
  isManualReportableKpi,
  isNonTargetKpi,
  isStatisticKpi,
  isSystemComputedKpi,
  parseKpiKind,
  parseKpiStoredStatus,
  STATISTIC_STATUS,
  targetKpisOnly,
} from "./kind";

describe("kpi kind helpers", () => {
  it("parses kind defaults to TARGET", () => {
    assert.equal(parseKpiKind(null), "TARGET");
    assert.equal(parseKpiKind("STATISTIC"), "STATISTIC");
    assert.equal(parseKpiKind("CALCULATED"), "CALCULATED");
  });

  it("does not coerce Statistik status to Gul", () => {
    assert.equal(parseKpiStoredStatus("Statistik"), STATISTIC_STATUS);
    assert.equal(parseKpiStoredStatus("Grön"), "Grön");
    assert.equal(parseKpiStoredStatus("unknown"), "Gul");
  });

  it("excludes statistics and calculated from G/Y/R counts", () => {
    const kpis = [
      { kind: "TARGET" as const, status: "Grön" as const },
      { kind: "TARGET" as const, status: "Gul" as const },
      { kind: "STATISTIC" as const, status: STATISTIC_STATUS },
      { kind: "CALCULATED" as const, status: STATISTIC_STATUS },
      { kind: "TARGET" as const, status: "Röd" as const },
    ];
    assert.deepEqual(countTargetKpiStatuses(kpis), {
      Grön: 1,
      Gul: 1,
      Röd: 1,
    });
    assert.equal(targetKpisOnly(kpis).length, 3);
    assert.equal(isStatisticKpi(kpis[2]), true);
    assert.equal(isCalculatedKpi(kpis[3]), true);
    assert.equal(isNonTargetKpi(kpis[2]), true);
    assert.equal(isNonTargetKpi(kpis[3]), true);
    assert.equal(isManualReportableKpi(kpis[0]), true);
    assert.equal(isManualReportableKpi(kpis[2]), true);
    assert.equal(isManualReportableKpi(kpis[3]), false);
  });

  it("treats TARGET with RATIO calc as system-computed, not manually reportable", () => {
    const computedTarget = {
      kind: "TARGET" as const,
      calcOperator: "RATIO_PERCENT" as const,
    };
    const weighted = {
      kind: "TARGET" as const,
      calcOperator: "WEIGHTED_RATIO_PERCENT" as const,
    };
    const manualTarget = { kind: "TARGET" as const, calcOperator: null };
    assert.equal(isSystemComputedKpi(computedTarget), true);
    assert.equal(isSystemComputedKpi(weighted), true);
    assert.equal(isSystemComputedKpi(manualTarget), false);
    assert.equal(isManualReportableKpi(computedTarget), false);
    assert.equal(isManualReportableKpi(weighted), false);
    assert.equal(isManualReportableKpi(manualTarget), true);
    assert.equal(isNonTargetKpi(computedTarget), false);
  });
});
