import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyDashboardTargetKpis } from "./reportedTargetKpis";

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
