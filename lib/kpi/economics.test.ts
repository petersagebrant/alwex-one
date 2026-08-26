import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthlyResultState,
  computeEconomicDeviation,
  computeEconomicDeviationPercent,
  computeEconomicMargin,
  computeMonthToDateSum,
  computeYearToDateEconomicSum,
  expectedResultFinalizationDate,
  expectedResultPeriodMonth,
  economicSignedTone,
  formatEconomicMarginPercent,
  formatEconomicPercent,
  formatExpectedFinalizationSv,
  formatMonthlyEconomicSummary,
  formatPeriodMonthSv,
  isMonthlyEconomicKpi,
  isMonthlyEconomicResultKpi,
  isMonthlyRevenueVsBudgetKpi,
  monthlyResultDisplayName,
  resolveMonthlyEconomicValues,
} from "./economics";
import { computeKpiStatus } from "./computeStatus";

describe("shared economic KPI semantics", () => {
  it("sums month-to-date values through report date without mixing months", () => {
    const rows = [
      { reportDate: "2026-07-31", value: "900" },
      { reportDate: "2026-08-01", value: "100" },
      { reportDate: "2026-08-02", value: "250,5" },
      { reportDate: "2026-08-20", value: "999" },
      { reportDate: "2026-09-01", value: "700" },
    ];
    assert.equal(computeMonthToDateSum(rows, "2026-08-02"), "350,5");
  });

  it("recalculates consistently after a backdated input changes", () => {
    const rows = [
      { reportDate: "2026-08-01", value: "100" },
      { reportDate: "2026-08-02", value: "200" },
      { reportDate: "2026-08-03", value: "300" },
    ];
    assert.equal(computeMonthToDateSum(rows, "2026-08-03"), "600");
    rows[1]!.value = "250";
    assert.equal(computeMonthToDateSum(rows, "2026-08-02"), "350");
    assert.equal(computeMonthToDateSum(rows, "2026-08-03"), "650");
  });

  it("expects the previous calendar month across year boundaries", () => {
    assert.equal(
      expectedResultPeriodMonth(new Date("2026-08-18T10:00:00Z")),
      "2026-07-01",
    );
    assert.equal(
      expectedResultPeriodMonth(new Date("2026-01-10T10:00:00Z")),
      "2025-12-01",
    );
  });

  it("formats Swedish month names with optional year", () => {
    assert.equal(formatPeriodMonthSv("2026-08-01"), "Augusti");
    assert.equal(
      formatPeriodMonthSv("2026-08-01", { includeYear: true }),
      "Augusti 2026",
    );
  });

  it("expresses expected closing around day 22 of following month", () => {
    assert.equal(expectedResultFinalizationDate("2026-07-01"), "2026-08-22");
    assert.equal(formatExpectedFinalizationSv("2026-07-01"), "22 augusti");
  });

  it("keeps pending result neutral and explicitly labels the period", () => {
    const state = buildMonthlyResultState({
      now: new Date("2026-08-18T10:00:00Z"),
      latestFinalizedPeriodMonth: "2026-06-01",
    });
    assert.equal(state.expectedPeriodLabel, "Juli");
    assert.equal(state.isPending, true);
    assert.equal(state.isExpectedPeriodFinalized, false);
    assert.equal(state.expectedFinalizationLabel, "22 augusti");
    assert.equal(state.latestFinalizedPeriodLabel, "Juni 2026");
  });

  it("marks the expected period finalized independently of entry timestamp", () => {
    const state = buildMonthlyResultState({
      now: new Date("2026-08-22T15:00:00Z"),
      latestFinalizedPeriodMonth: "2026-07-01",
    });
    assert.equal(state.isPending, false);
    assert.equal(formatPeriodMonthSv("2026-07-01"), "Juli");
  });

  it("labels stale finalized result with its actual period", () => {
    assert.equal(
      monthlyResultDisplayName("Resultat mot budget", "2026-07-01"),
      "Resultat mot budget – Juli",
    );
  });

  it("scopes monthly economic presentation to Resultat mot budget", () => {
    assert.equal(
      isMonthlyEconomicResultKpi({
        name: "Resultat mot budget",
        reportingFrequency: "MONTHLY",
      }),
      true,
    );
    assert.equal(
      isMonthlyEconomicResultKpi({
        name: "Annan månads-KPI",
        reportingFrequency: "MONTHLY",
      }),
      false,
    );
    assert.equal(
      isMonthlyEconomicResultKpi({
        name: "Omsättning mot budget",
        reportingFrequency: "MONTHLY",
      }),
      false,
    );
  });

  it("treats Omsättning mot budget as the economic sibling, not the huvud-KPI", () => {
    assert.equal(
      isMonthlyRevenueVsBudgetKpi({ name: "Omsättning mot budget" }),
      true,
    );
    assert.equal(
      isMonthlyEconomicKpi({
        name: "Omsättning mot budget",
        reportingFrequency: "MONTHLY",
      }),
      true,
    );
    assert.equal(
      isMonthlyEconomicKpi({
        name: "Resultat mot budget",
        reportingFrequency: "MONTHLY",
      }),
      true,
    );
    assert.equal(
      isMonthlyRevenueVsBudgetKpi({ name: "Resultat mot budget" }),
      false,
    );
  });

  it("computes deviation percent against absolute budget and skips budget 0", () => {
    assert.equal(computeEconomicDeviationPercent("1,2", "0,8"), "50");
    assert.equal(computeEconomicDeviationPercent("1,0", "1,2"), "-16,667");
    assert.equal(computeEconomicDeviationPercent("1,2", "0"), null);
    assert.equal(computeEconomicDeviationPercent("1,2", null), null);
    assert.equal(formatEconomicPercent("50"), "+50 %");
    assert.equal(formatEconomicPercent("-16,667"), "-16,667 %");
  });

  it("computes margin from same-month result and revenue", () => {
    assert.equal(computeEconomicMargin("1,2", "10"), "12,0");
    assert.equal(computeEconomicMargin("0", "10"), "0,0");
    assert.equal(computeEconomicMargin("1,2", "0"), null);
    assert.equal(computeEconomicMargin("1,2", null), null);
  });

  it("formats result margin as one decimal percent without double-scaling", () => {
    assert.equal(computeEconomicMargin("1,1", "12,4"), "8,9");
    assert.equal(formatEconomicMarginPercent("1,1", "12,4"), "8,9 %");
    assert.notEqual(formatEconomicMarginPercent("1,1", "12,4"), "8,871 %");
    assert.notEqual(formatEconomicMarginPercent("1,1", "12,4"), "+887 %");
    assert.notEqual(formatEconomicMarginPercent("1,1", "12,4"), "887,1 %");
    assert.equal(formatEconomicMarginPercent("1,2", "10"), "12,0 %");
    assert.equal(formatEconomicMarginPercent("0", "10"), "0,0 %");
    assert.equal(formatEconomicMarginPercent("1,1", "0"), null);
    assert.equal(formatEconomicMarginPercent("1,1", null), null);
  });

  it("sums YTD actual/budget through selected month and skips missing", () => {
    const rows = [
      { periodMonth: "2025-12-01", actualValue: "9", budgetValue: "8" },
      { periodMonth: "2026-01-01", actualValue: "1,0", budgetValue: "1,2" },
      { periodMonth: "2026-02-01", actualValue: "1,5", budgetValue: null },
      { periodMonth: "2026-03-01", actualValue: "0,8", budgetValue: "1,0" },
      { periodMonth: "2026-04-01", actualValue: "2,0", budgetValue: "1,8" },
    ];
    assert.deepEqual(computeYearToDateEconomicSum(rows, "2026-03-01"), {
      actualValue: "3,3",
      budgetValue: "2,2",
    });
    assert.deepEqual(computeYearToDateEconomicSum(rows, "2025-12-01"), {
      actualValue: "9",
      budgetValue: "8",
    });
    assert.deepEqual(computeYearToDateEconomicSum([], "2026-03-01"), {
      actualValue: null,
      budgetValue: null,
    });
  });

  it("colors signed deviation green/red and treats zero as neutral", () => {
    assert.equal(economicSignedTone("+0,4 Mkr"), "positive");
    assert.equal(economicSignedTone("-0,3 Mkr"), "negative");
    assert.equal(economicSignedTone("0 Mkr"), "neutral");
    assert.equal(economicSignedTone(null), "neutral");
    assert.equal(economicSignedTone("0", { zero: "positive" }), "positive");
  });

  it("computes 1,2 minus 0,8 as +0,4 and evaluates it green", () => {
    const deviation = computeEconomicDeviation("1,2", "0,8");
    assert.equal(deviation, "0,4");
    assert.equal(
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        greenTolerance: null,
        yellowTolerance: 0.2,
        value: deviation,
        target: 0,
      }),
      "Grön",
    );
  });

  it("uses yellow and red bands for negative deviation", () => {
    const status = (value: string) =>
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        yellowTolerance: 0.2,
        value,
        target: 0,
      });
    assert.equal(status("-0,1"), "Gul");
    assert.equal(status("-0,3"), "Röd");
  });

  it("keeps partial operands pending and neutral", () => {
    const partial = resolveMonthlyEconomicValues({
      actualValue: "1,2",
      budgetValue: null,
    });
    assert.equal(partial.isComplete, false);
    assert.equal(partial.deviationValue, null);
    assert.match(
      formatMonthlyEconomicSummary({
        actualValue: "1,2",
        periodMonth: "2026-07-01",
      }),
      /Inväntar bokslut/,
    );
  });

  it("preserves and labels legacy deviation without inventing operands", () => {
    const legacy = resolveMonthlyEconomicValues({ deviationValue: "-0,3" });
    assert.equal(legacy.isLegacyDeviation, true);
    assert.equal(legacy.actualValue, null);
    assert.equal(legacy.budgetValue, null);
    assert.match(
      formatMonthlyEconomicSummary({
        deviationValue: "-0,3",
        periodMonth: "2026-06-01",
        unit: "Mkr",
      }),
      /Äldre avvikelse: -0,3 Mkr \(resultat och budget saknas\)/,
    );
  });

  it("formats period, result, budget and deviation explicitly", () => {
    assert.equal(
      formatMonthlyEconomicSummary({
        actualValue: "1,2",
        budgetValue: "0,8",
        deviationValue: "999",
        periodMonth: "2026-07-01",
        unit: "Mkr",
        status: "Grön",
      }),
      "Resultatmånad: Juli 2026. Faktiskt resultat: 1,2 Mkr. Budgeterat resultat: 0,8 Mkr. Avvikelse: +0,4 Mkr. Status: Grön",
    );
  });
});
