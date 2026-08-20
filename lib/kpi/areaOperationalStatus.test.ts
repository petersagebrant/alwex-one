import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STATISTIC_STATUS } from "./kind";
import {
  computeAreaOperationalStatus,
  formatAreaOperationalStatus,
  reportedTargetStatusTone,
} from "./areaOperationalStatus";

describe("computeAreaOperationalStatus", () => {
  it("returns null for an empty list", () => {
    assert.equal(computeAreaOperationalStatus([]), null);
  });

  it("returns null when only STATISTIC KPIs exist", () => {
    assert.equal(
      computeAreaOperationalStatus([
        {
          kind: "STATISTIC",
          status: STATISTIC_STATUS,
          currentValue: "1200",
        },
      ]),
      null,
    );
  });

  it("returns null when only CALCULATED KPIs exist", () => {
    assert.equal(
      computeAreaOperationalStatus([
        {
          kind: "CALCULATED",
          status: STATISTIC_STATUS,
          currentValue: "42",
        },
      ]),
      null,
    );
  });

  it("returns null when TARGET KPIs have no current value", () => {
    assert.equal(
      computeAreaOperationalStatus([
        { kind: "TARGET", status: "Gul", currentValue: null },
        { kind: "TARGET", status: "Röd", currentValue: "—" },
        { kind: "TARGET", status: "Grön", currentValue: "  " },
      ]),
      null,
    );
  });

  it("uses worst-of Röd before Grön", () => {
    assert.equal(
      computeAreaOperationalStatus([
        { kind: "TARGET", status: "Röd", currentValue: "1" },
        { kind: "TARGET", status: "Grön", currentValue: "9" },
      ]),
      "Röd",
    );
  });

  it("uses worst-of Gul before Grön", () => {
    assert.equal(
      computeAreaOperationalStatus([
        { kind: "TARGET", status: "Gul", currentValue: "5" },
        { kind: "TARGET", status: "Grön", currentValue: "9" },
      ]),
      "Gul",
    );
  });

  it("returns Grön when every reported TARGET is Grön", () => {
    assert.equal(
      computeAreaOperationalStatus([
        { kind: "TARGET", status: "Grön", currentValue: "3" },
        { kind: "TARGET", status: "Grön", currentValue: "4" },
      ]),
      "Grön",
    );
  });

  it("does not count pending monthly TARGET", () => {
    assert.equal(
      computeAreaOperationalStatus([
        {
          kind: "TARGET",
          status: "Röd",
          currentValue: "-1",
          isPeriodPending: true,
        },
        { kind: "TARGET", status: "Grön", currentValue: "8" },
      ]),
      "Grön",
    );
    assert.equal(
      computeAreaOperationalStatus([
        {
          kind: "TARGET",
          status: "Röd",
          currentValue: "-1",
          isPeriodPending: true,
        },
      ]),
      null,
    );
  });

  it("lets a reported RATIO TARGET turn the area red or yellow", () => {
    assert.equal(
      computeAreaOperationalStatus([
        { kind: "TARGET", status: "Röd", currentValue: "8,2" },
        { kind: "STATISTIC", status: STATISTIC_STATUS, currentValue: "10" },
      ]),
      "Röd",
    );
    assert.equal(
      computeAreaOperationalStatus([
        { kind: "TARGET", status: "Gul", currentValue: "4,1" },
        { kind: "TARGET", status: "Grön", currentValue: "90" },
      ]),
      "Gul",
    );
  });

  it("formats null as Ej rapporterat", () => {
    assert.equal(formatAreaOperationalStatus(null), "Ej rapporterat");
    assert.equal(formatAreaOperationalStatus("Röd"), "Röd");
  });

  it("treats pending TARGET as unreported for the period", () => {
    assert.equal(
      reportedTargetStatusTone({
        kind: "TARGET",
        status: "Röd",
        currentValue: "-2",
        isPeriodPending: true,
      }),
      null,
    );
  });
});
