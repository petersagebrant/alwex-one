import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeCalculatedValue,
  computeDivideValue,
  computeRatioPercentValue,
  computeSumDivideValue,
  computeWeightedRatioPercent,
  formatCalculatedValueSv,
} from "./calculated";

describe("calculated KPI helpers", () => {
  it("formats Swedish decimals without trailing zeros", () => {
    assert.equal(formatCalculatedValueSv(12), "12");
    assert.equal(formatCalculatedValueSv(12.5), "12,5");
    assert.equal(formatCalculatedValueSv(12.125), "12,125");
  });

  it("divides Körda mil / Antal RC", () => {
    assert.equal(computeDivideValue("2500", "20"), "125");
    assert.equal(computeDivideValue("1 250,5", "10"), "125,05");
  });

  it("divides Omsättning / Körda mil (Kr per mil)", () => {
    assert.equal(computeDivideValue("500000", "20000"), "25");
    assert.equal(computeDivideValue("500 000", "20 000"), "25");
  });

  it("computes SUM_DIVIDE as (A+B)/C", () => {
    assert.equal(
      computeSumDivideValue(["100", "50"], "10"),
      "15",
    );
    assert.equal(
      computeSumDivideValue(["1 000", "250,5"], "10"),
      "125,05",
    );
    // Lager: Kolli OOH + Byggmax / Arbetade timmar
    assert.equal(
      computeSumDivideValue(["8000", "2000"], "500"),
      "20",
    );
  });

  it("does not compute SUM_DIVIDE when any input missing or denominator zero", () => {
    assert.equal(computeSumDivideValue(["100", null], "10"), null);
    assert.equal(computeSumDivideValue(["100", "50"], "0"), null);
    assert.equal(computeSumDivideValue([], "10"), null);
    assert.equal(computeSumDivideValue(["100"], null), null);
  });

  it("does not compute when denominator missing or zero", () => {
    assert.equal(computeDivideValue("100", null), null);
    assert.equal(computeDivideValue("100", "0"), null);
    assert.equal(computeDivideValue("100", ""), null);
    assert.equal(computeDivideValue(null, "10"), null);
  });

  it("computes RATIO_PERCENT as percent", () => {
    assert.equal(computeRatioPercentValue("32", "1000"), "3,2");
    assert.equal(computeRatioPercentValue("1 250,5", "10000"), "12,505");
  });

  it("skips RATIO_PERCENT when denominator missing or zero", () => {
    assert.equal(computeRatioPercentValue("32", null), null);
    assert.equal(computeRatioPercentValue("32", "0"), null);
    assert.equal(computeRatioPercentValue(null, "1000"), null);
  });

  it("computes WEIGHTED_RATIO_PERCENT as sum/sum×100, not average of %", () => {
    // AO1: 10/100 = 10%, AO2: 10/900 ≈ 1.11% — average would be ~5.55%
    // Weighted: 20/1000 = 2%
    const result = computeWeightedRatioPercent([
      { numeratorValue: "10", denominatorValue: "100" },
      { numeratorValue: "10", denominatorValue: "900" },
    ]);
    assert.equal(result.value, "2");
    assert.equal(result.reportedParts, 2);
    assert.equal(result.totalParts, 2);
    assert.equal(result.isComplete, true);
    assert.equal(result.completenessLabel, "2 av 2 affärsområden rapporterade");
  });

  it("excludes incomplete parts from weighted sum and surfaces completeness", () => {
    const result = computeWeightedRatioPercent([
      { numeratorValue: "32", denominatorValue: "1000" },
      { numeratorValue: "10", denominatorValue: null },
      { numeratorValue: null, denominatorValue: "500" },
      { numeratorValue: "5", denominatorValue: "0" },
      { numeratorValue: "20", denominatorValue: "500" },
    ]);
    // Only pairs 1 and 5: (32+20)/(1000+500) = 52/1500 ≈ 3.467
    assert.equal(result.value, "3,467");
    assert.equal(result.reportedParts, 2);
    assert.equal(result.totalParts, 5);
    assert.equal(result.isComplete, false);
    assert.equal(result.completenessLabel, "2 av 5 affärsområden rapporterade");
  });

  it("returns null weighted value when no complete parts", () => {
    const result = computeWeightedRatioPercent([
      { numeratorValue: "10", denominatorValue: null },
      { numeratorValue: null, denominatorValue: "100" },
    ]);
    assert.equal(result.value, null);
    assert.equal(result.reportedParts, 0);
    assert.equal(result.isComplete, false);
  });

  it("supports DIVIDE, SUM_DIVIDE, MTD sum and RATIO_PERCENT", () => {
    assert.equal(
      computeCalculatedValue({
        operator: "MONTH_TO_DATE_SUM",
        numeratorValue: null,
        denominatorValue: null,
        numeratorValues: ["100", "250,5"],
      }),
      "350,5",
    );
    assert.equal(
      computeCalculatedValue({
        operator: "DIVIDE",
        numeratorValue: "100",
        denominatorValue: "4",
      }),
      "25",
    );
    assert.equal(
      computeCalculatedValue({
        operator: "SUM_DIVIDE",
        numeratorValue: null,
        denominatorValue: "10",
        numeratorValues: ["100", "50"],
      }),
      "15",
    );
    assert.equal(
      computeCalculatedValue({
        operator: "RATIO_PERCENT",
        numeratorValue: "32",
        denominatorValue: "1000",
      }),
      "3,2",
    );
    assert.equal(
      computeCalculatedValue({
        operator: "WEIGHTED_RATIO_PERCENT",
        numeratorValue: "32",
        denominatorValue: "1000",
      }),
      null,
    );
    assert.equal(
      computeCalculatedValue({
        operator: null,
        numeratorValue: "100",
        denominatorValue: "4",
      }),
      null,
    );
  });
});
