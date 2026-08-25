import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNumeric } from "../kpi/parseNumeric";
import { computeMeasurableProgressAndStatus } from "./autoCalc";

describe("parseNumeric live-goal strings", () => {
  it("turns Budget ±0 into 0 and Enligt plan into null", () => {
    assert.equal(parseNumeric("Budget ±0"), 0);
    assert.equal(parseNumeric("Enligt plan"), null);
  });
});

describe("computeMeasurableProgressAndStatus", () => {
  it("skips auto-calc for live Fröträdet text values", () => {
    const result = computeMeasurableProgressAndStatus({
      currentValue: "Enligt plan",
      targetValue: "Budget ±0",
      deadline: "2026-12-31",
      createdAt: "2026-01-01",
      today: "2026-08-24",
    });
    assert.equal(result.computed, false);
    assert.equal(result.progress, null);
    assert.equal(result.status, null);
  });

  it("skips when target is 0 even if current is numeric", () => {
    const result = computeMeasurableProgressAndStatus({
      currentValue: "70",
      targetValue: "0",
      today: "2026-08-24",
    });
    assert.equal(result.computed, false);
  });

  it("skips when current is unparseable", () => {
    const result = computeMeasurableProgressAndStatus({
      currentValue: "Enligt plan",
      targetValue: "100",
      today: "2026-08-24",
    });
    assert.equal(result.computed, false);
  });

  it("computes percent and no-deadline status bands", () => {
    assert.deepEqual(
      computeMeasurableProgressAndStatus({
        currentValue: "100",
        targetValue: "100",
        today: "2026-08-24",
      }),
      { computed: true, progress: 100, status: "Grön" },
    );
    assert.deepEqual(
      computeMeasurableProgressAndStatus({
        currentValue: "70",
        targetValue: "100",
        today: "2026-08-24",
      }),
      { computed: true, progress: 70, status: "Gul" },
    );
    assert.deepEqual(
      computeMeasurableProgressAndStatus({
        currentValue: "69",
        targetValue: "100",
        today: "2026-08-24",
      }),
      { computed: true, progress: 69, status: "Röd" },
    );
  });

  it("clamps progress to 0–100 and rounds", () => {
    assert.equal(
      computeMeasurableProgressAndStatus({
        currentValue: "150",
        targetValue: "100",
        today: "2026-08-24",
      }).progress,
      100,
    );
    assert.equal(
      computeMeasurableProgressAndStatus({
        currentValue: "-10",
        targetValue: "100",
        today: "2026-08-24",
      }).progress,
      0,
    );
    assert.equal(
      computeMeasurableProgressAndStatus({
        currentValue: "1",
        targetValue: "3",
        today: "2026-08-24",
      }).progress,
      33,
    );
  });

  it("uses time-linear expected progress against deadline", () => {
    const base = {
      currentValue: "50",
      targetValue: "100",
      createdAt: "2026-01-01",
      deadline: "2026-12-31",
      today: "2026-07-02",
    };
    // 182 / 364 * 100 = 50 expected
    assert.deepEqual(computeMeasurableProgressAndStatus(base), {
      computed: true,
      progress: 50,
      status: "Grön",
    });
    assert.deepEqual(
      computeMeasurableProgressAndStatus({ ...base, currentValue: "40" }),
      { computed: true, progress: 40, status: "Gul" },
    );
    assert.deepEqual(
      computeMeasurableProgressAndStatus({ ...base, currentValue: "20" }),
      { computed: true, progress: 20, status: "Röd" },
    );
  });

  it("marks overdue incomplete goals red even if pace was fine", () => {
    const result = computeMeasurableProgressAndStatus({
      currentValue: "90",
      targetValue: "100",
      createdAt: "2026-01-01",
      deadline: "2026-06-01",
      today: "2026-06-02",
    });
    assert.deepEqual(result, {
      computed: true,
      progress: 90,
      status: "Röd",
    });
  });

  it("keeps completed goals green after the deadline", () => {
    const result = computeMeasurableProgressAndStatus({
      currentValue: "100",
      targetValue: "100",
      createdAt: "2026-01-01",
      deadline: "2026-06-01",
      today: "2026-06-02",
    });
    assert.deepEqual(result, {
      computed: true,
      progress: 100,
      status: "Grön",
    });
  });
});
