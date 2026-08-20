import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectKeyKpis } from "./selectKeyKpis";

describe("selectKeyKpis", () => {
  it("returns at most four TARGET KPIs", () => {
    const kpis = [
      {
        id: "1",
        kind: "TARGET" as const,
        status: "Grön" as const,
        currentValue: "1",
      },
      {
        id: "2",
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: "2",
      },
      {
        id: "3",
        kind: "TARGET" as const,
        status: "Röd" as const,
        currentValue: "3",
      },
      {
        id: "4",
        kind: "TARGET" as const,
        status: "Grön" as const,
        currentValue: "4",
      },
      {
        id: "5",
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: "5",
      },
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

  it("excludes TARGET without a valid numeric current value", () => {
    const kpis = [
      {
        id: "missing",
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: null,
        targetValue: "90",
      },
      {
        id: "placeholder",
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: "—",
        targetValue: "90",
      },
      {
        id: "ok",
        kind: "TARGET" as const,
        status: "Grön" as const,
        currentValue: "92",
        targetValue: "90",
      },
    ];
    assert.deepEqual(
      selectKeyKpis(kpis).map((kpi) => kpi.id),
      ["ok"],
    );
  });

  it("allows RATIO_PERCENT TARGET (e.g. Sjukfrånvaro) as key KPI", () => {
    const kpis = [
      {
        id: "sjuk",
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: "3,2",
        targetValue: "3",
      },
      {
        id: "manual",
        kind: "TARGET" as const,
        status: "Grön" as const,
        currentValue: "99",
        targetValue: "97",
      },
    ];
    assert.deepEqual(
      selectKeyKpis(kpis).map((kpi) => kpi.id),
      ["sjuk", "manual"],
    );
  });

  it("orders Röd before Gul before Grön", () => {
    const kpis = [
      {
        id: "g",
        kind: "TARGET" as const,
        status: "Grön" as const,
        currentValue: "1",
      },
      {
        id: "r",
        kind: "TARGET" as const,
        status: "Röd" as const,
        currentValue: "1",
      },
      {
        id: "y",
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: "1",
      },
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
      {
        id: "1",
        kind: "TARGET" as const,
        status: "Röd" as const,
        currentValue: "1",
      },
      {
        id: "2",
        kind: "TARGET" as const,
        status: "Röd" as const,
        currentValue: "2",
      },
      {
        id: "3",
        kind: "TARGET" as const,
        status: "Gul" as const,
        currentValue: "3",
      },
    ];
    assert.equal(selectKeyKpis(kpis, 2).length, 2);
  });
});
