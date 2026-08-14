import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSjukfranvaroVdCompletenessLabel } from "./sjukfranvaroCompletenessLabel";

describe("formatSjukfranvaroVdCompletenessLabel", () => {
  it("returns preliminary copy when some but not all areas reported", () => {
    assert.equal(
      formatSjukfranvaroVdCompletenessLabel({
        reportedAreas: 5,
        totalAreas: 7,
        isComplete: false,
      }),
      "Preliminärt – baserat på rapporterade affärsområden (5 av 7)",
    );
  });

  it("returns null when all areas reported (final daily value)", () => {
    assert.equal(
      formatSjukfranvaroVdCompletenessLabel({
        reportedAreas: 7,
        totalAreas: 7,
        isComplete: true,
      }),
      null,
    );
  });

  it("returns null when nothing reported", () => {
    assert.equal(
      formatSjukfranvaroVdCompletenessLabel({
        reportedAreas: 0,
        totalAreas: 7,
        isComplete: false,
      }),
      null,
    );
  });
});
