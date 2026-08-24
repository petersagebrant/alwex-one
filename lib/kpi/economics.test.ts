import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthlyResultState,
  computeEconomicDeviation,
  computeMonthToDateSum,
  expectedResultFinalizationDate,
  expectedResultPeriodMonth,
  formatExpectedFinalizationSv,
  formatMonthlyEconomicSummary,
  formatPeriodMonthSv,
  isMonthlyEconomicResultKpi,
  monthlyResultDisplayName,
  resolveMonthlyEconomicValues,
} from "./economics";
import { computeKpiStatus } from "./computeStatus";

describe("shared economic KPI semantics", () => {
  it("sums daily revenue through report date without mixing months", () => {
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
