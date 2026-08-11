import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldWriteKpiMeasurementHistory } from "./shouldWriteMeasurementHistory";

describe("shouldWriteKpiMeasurementHistory", () => {
  it("does not write history for metadata-only / status-recompute changes", () => {
    assert.equal(
      shouldWriteKpiMeasurementHistory([
        { field: "direction" },
        { field: "tolerance_type" },
        { field: "yellow_tolerance" },
        { field: "status" },
      ]),
      false,
    );
    assert.equal(
      shouldWriteKpiMeasurementHistory([
        { field: "name" },
        { field: "category" },
        { field: "unit" },
        { field: "target_value" },
        { field: "trend" },
        { field: "business_area_id" },
      ]),
      false,
    );
    assert.equal(
      shouldWriteKpiMeasurementHistory([{ field: "status" }]),
      false,
    );
  });

  it("writes history only when current_value changes", () => {
    assert.equal(
      shouldWriteKpiMeasurementHistory([{ field: "current_value" }]),
      true,
    );
    assert.equal(
      shouldWriteKpiMeasurementHistory([
        { field: "current_value" },
        { field: "status" },
        { field: "direction" },
      ]),
      true,
    );
  });
});
