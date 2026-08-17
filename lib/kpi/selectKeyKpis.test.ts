import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectKeyKpis } from "./selectKeyKpis";

describe("selectKeyKpis", () => {
  it("returns at most four TARGET KPIs", () => {
    const kpis = [
      { id: "1", kind: "TARGET" as const, status: "Grön" as const },
      { id: "2", kind: "TARGET" as const, status: "Gul" as const },
      { id: "3", kind: "TARGET" as const, status: "Röd" as const },
      { id: "4", kind: "TARGET" as const, status: "Grön" as const },
      { id: "5", kind: "TARGET" as const, status: "Gul" as const },
    ];
    assert.equal(selectKeyKpis(kpis).length, 4);
  });

  it("excludes STATISTIC and CALCULATED from key set", () => {
    const kpis = [
      {
        id: "stat",
        kind: "STATISTIC" as const,
        status: "Statistik" as const,
      },
      {
        id: "calc",
        kind: "CALCULATED" as const,
        status: "Statistik" as const,
      },
      {
        id: "red",
        kind: "TARGET" as const,
        status: "Röd" as const,
        currentValue: "10",
        targetValue: "5",
      },
    ];
    const selected = selectKeyKpis(kpis);
    assert.deepEqual(
      selected.map((kpi) => kpi.id),
      ["red"],
    );
  });

  it("orders Röd before Gul before Grön", () => {
    const kpis = [
      { id: "g", kind: "TARGET" as const, status: "Grön" as const },
      { id: "r", kind: "TARGET" as const, status: "Röd" as const },
      { id: "y", kind: "TARGET" as const, status: "Gul" as const },
    ];
    assert.deepEqual(
      selectKeyKpis(kpis).map((kpi) => kpi.id),
      ["r", "y", "g"],
    );
  });

  it("ranks same status by largest deviation from target", () => {
    const kpis = [
      {
        id: "small",
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: "9",
        targetValue: "10",
      },
      {
        id: "large",
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: "2",
        targetValue: "10",
      },
    ];
    assert.deepEqual(
      selectKeyKpis(kpis).map((kpi) => kpi.id),
      ["large", "small"],
    );
  });

  it("respects custom limit", () => {
    const kpis = [
      { id: "1", kind: "TARGET" as const, status: "Röd" as const },
      { id: "2", kind: "TARGET" as const, status: "Röd" as const },
      { id: "3", kind: "TARGET" as const, status: "Gul" as const },
    ];
    assert.equal(selectKeyKpis(kpis, 2).length, 2);
  });
});
