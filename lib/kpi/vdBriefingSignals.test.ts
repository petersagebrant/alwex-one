import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  briefingTrendDirection,
  canUseAuditAsKpiTrendSource,
  isBriefingKpiChangeTrendItem,
} from "./vdBriefingSignals";

describe("briefingTrendDirection", () => {
  it("does not treat audit Gul→Grön as improved without a live value", () => {
    assert.equal(
      briefingTrendDirection({
        liveCurrentValue: null,
        previousValue: "4",
        currentValue: "2",
        previousStatus: "Gul",
        currentStatus: "Grön",
        source: "audit_log",
      }),
      "okänd",
    );
    assert.equal(canUseAuditAsKpiTrendSource(), false);
    assert.equal(
      isBriefingKpiChangeTrendItem({
        source: "audit_log",
        previousValue: "4",
        currentValue: "2",
      }),
      false,
    );
  });

  it("does not use leftover history when live currentValue is missing", () => {
    assert.equal(
      briefingTrendDirection({
        liveCurrentValue: null,
        previousValue: "78",
        currentValue: "90",
        previousStatus: "Gul",
        currentStatus: "Grön",
        source: "kpi_history",
      }),
      "okänd",
    );
  });

  it("allows better/worse only with two parseable history values and a live value", () => {
    assert.equal(
      briefingTrendDirection({
        liveCurrentValue: "90",
        previousValue: "78",
        currentValue: "90",
        previousStatus: "Gul",
        currentStatus: "Grön",
        source: "kpi_history",
      }),
      "bättre",
    );
    assert.equal(
      briefingTrendDirection({
        liveCurrentValue: "4",
        previousValue: "2",
        currentValue: "4",
        previousStatus: "Grön",
        currentStatus: "Gul",
        source: "kpi_history",
      }),
      "sämre",
    );
    assert.equal(
      isBriefingKpiChangeTrendItem({
        source: "kpi_history",
        previousValue: "78",
        currentValue: "90",
      }),
      true,
    );
  });

  it("stays unknown with only one history value", () => {
    assert.equal(
      briefingTrendDirection({
        liveCurrentValue: "90",
        previousValue: null,
        currentValue: "90",
        previousStatus: null,
        currentStatus: "Grön",
        source: "kpi_history",
      }),
      "okänd",
    );
  });
});
