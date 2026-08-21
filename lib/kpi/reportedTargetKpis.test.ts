import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  briefingTargetStatusLabel,
  classifyDashboardTargetKpis,
  hasCompleteComputedOperands,
  isBriefingOpenKpiDeviation,
  isUnreportedTargetKpi,
  isUsableBriefingTargetKpi,
} from "./reportedTargetKpis";

describe("classifyDashboardTargetKpis", () => {
  it("ignores TARGET without a current value in follow-up and green counts", () => {
    const kpis = [
      {
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: null,
        calcOperator: null,
      },
      {
        kind: "TARGET" as const,
        status: "Röd" as const,
        currentValue: "—",
        calcOperator: null,
      },
      {
        kind: "TARGET" as const,
        status: "Grön" as const,
        currentValue: null,
        calcOperator: null,
      },
      {
        kind: "TARGET" as const,
        status: "Grön" as const,
        currentValue: "12",
        calcOperator: null,
      },
      {
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: "4",
        calcOperator: null,
      },
    ];

    const result = classifyDashboardTargetKpis(kpis);
    assert.equal(result.greenKpis.length, 1);
    assert.equal(result.yellowKpis.length, 1);
    assert.equal(result.redKpis.length, 0);
    assert.equal(result.followUpKpis.length, 1);
    assert.equal(result.followUpKpis[0]?.status, "Gul");
  });

  it("excludes pending monthly TARGET from all dashboard buckets", () => {
    const result = classifyDashboardTargetKpis([
      {
        kind: "TARGET",
        status: "Röd",
        currentValue: "-1",
        isPeriodPending: true,
        calcOperator: null,
      },
      {
        kind: "TARGET",
        status: "Grön",
        currentValue: "3",
        isPeriodPending: false,
        calcOperator: null,
      },
    ]);
    assert.equal(result.greenKpis.length, 1);
    assert.equal(result.redKpis.length, 0);
    assert.equal(result.followUpKpis.length, 0);
  });

  it("keeps RATIO TARGET out of follow-up lists but not out of green counts", () => {
    const result = classifyDashboardTargetKpis([
      {
        kind: "TARGET",
        status: "Röd",
        currentValue: "8",
        calcOperator: "RATIO_PERCENT",
      },
      {
        kind: "TARGET",
        status: "Grön",
        currentValue: "2",
        calcOperator: "RATIO_PERCENT",
      },
      {
        kind: "TARGET",
        status: "Gul",
        currentValue: "5",
        calcOperator: null,
      },
    ]);
    assert.equal(result.greenKpis.length, 1);
    assert.equal(result.redKpis.length, 0);
    assert.equal(result.yellowKpis.length, 1);
    assert.equal(result.followUpKpis.length, 1);
  });
});

describe("briefing TARGET reporting helpers", () => {
  it("treats currentValue=null + stored Gul as unreported, not a deviation", () => {
    const kpi = {
      kind: "TARGET" as const,
      status: "Gul" as const,
      currentValue: null,
      calcOperator: null,
    };
    assert.equal(isUnreportedTargetKpi(kpi), true);
    assert.equal(isBriefingOpenKpiDeviation(kpi), false);
    assert.equal(isUsableBriefingTargetKpi(kpi), false);
    assert.equal(briefingTargetStatusLabel(kpi), "Ej rapporterat");
  });

  it("keeps reported Gul as an open deviation", () => {
    const kpi = {
      kind: "TARGET" as const,
      status: "Gul" as const,
      currentValue: "4",
      calcOperator: null,
    };
    assert.equal(isBriefingOpenKpiDeviation(kpi), true);
    assert.equal(briefingTargetStatusLabel(kpi), "Gul");
  });

  it("rejects system-computed TARGET when operands are missing", () => {
    const kpi = {
      id: "ratio",
      kind: "TARGET" as const,
      status: "Gul" as const,
      currentValue: "8",
      calcOperator: "RATIO_PERCENT" as const,
      calcNumeratorKpiId: "num",
      calcDenominatorKpiId: "den",
    };
    const byId = new Map([
      ["num", { id: "num", currentValue: null }],
      ["den", { id: "den", currentValue: "40" }],
    ]);
    assert.equal(hasCompleteComputedOperands(kpi, byId), false);
    assert.equal(isUsableBriefingTargetKpi(kpi, byId), false);
    assert.equal(isBriefingOpenKpiDeviation(kpi, byId), false);
  });
});
