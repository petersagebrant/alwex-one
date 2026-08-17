import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countTargetKpiStatuses,
  effectiveTargetStatusTone,
  hasValidKpiCurrentValue,
  isCalculatedKpi,
  isManualReportableKpi,
  isNonTargetKpi,
  isStatisticKpi,
  isSystemComputedKpi,
  isWeightedRatioPercentKpi,
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
      { kind: "TARGET" as const, status: "Grön" as const, currentValue: "10" },
      { kind: "TARGET" as const, status: "Gul" as const, currentValue: "5" },
      { kind: "STATISTIC" as const, status: STATISTIC_STATUS, currentValue: "1" },
      {
        kind: "CALCULATED" as const,
        status: STATISTIC_STATUS,
        currentValue: "2",
      },
      { kind: "TARGET" as const, status: "Röd" as const, currentValue: "1" },
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

  it("does not count TARGET KPIs without a current value as G/Y/R", () => {
    const kpis = [
      { kind: "TARGET" as const, status: "Gul" as const, currentValue: null },
      { kind: "TARGET" as const, status: "Gul" as const, currentValue: "  " },
      { kind: "TARGET" as const, status: "Grön" as const, currentValue: "3" },
      { kind: "TARGET" as const, status: "Röd" as const, currentValue: "9" },
    ];
    assert.equal(hasValidKpiCurrentValue(null), false);
    assert.equal(hasValidKpiCurrentValue("  "), false);
    assert.equal(hasValidKpiCurrentValue("3"), true);
    assert.equal(
      effectiveTargetStatusTone({
        kind: "TARGET",
        status: "Gul",
        currentValue: null,
      }),
      null,
    );
    assert.deepEqual(countTargetKpiStatuses(kpis), {
      Grön: 1,
      Gul: 0,
      Röd: 1,
    });
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
    assert.equal(isWeightedRatioPercentKpi(weighted), true);
    assert.equal(isWeightedRatioPercentKpi(computedTarget), false);
    assert.equal(isWeightedRatioPercentKpi(manualTarget), false);
  });
});
