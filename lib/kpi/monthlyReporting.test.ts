import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expectedResultPeriodMonth } from "./economics";
import {
  isDailyManualReportableKpi,
  isMonthlyEconomicTargetKpi,
  isMonthlyStatisticKpi,
  STATISTIC_STATUS,
} from "./kind";
import {
  monthlyStatisticPeriodLabel,
  splitManualReportableKpis,
  toMonthlyReportItem,
} from "./monthlyReporting";
import type { KPI, KPIHistory } from "@/types";

function baseKpi(overrides: Partial<KPI>): KPI {
  return {
    id: "kpi-1",
    businessAreaId: "area-1",
    name: "Test",
    category: "Volym",
    targetValue: null,
    currentValue: null,
    unit: "st",
    status: STATISTIC_STATUS,
    trend: "Oförändrad",
    kind: "STATISTIC",
    direction: null,
    toleranceType: null,
    greenTolerance: null,
    yellowTolerance: null,
    calcOperator: null,
    calcNumeratorKpiId: null,
    calcDenominatorKpiId: null,
    ratioReportingMode: "GROUPED",
    reportingFrequency: "DAILY",
    archivedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function history(overrides: Partial<KPIHistory>): KPIHistory {
  return {
    id: "h-1",
    kpiId: "kpi-1",
    value: "12",
    status: STATISTIC_STATUS,
    comment: null,
    recordedAt: "2026-08-24T10:00:00.000Z",
    createdAt: "2026-08-24T10:00:00.000Z",
    updatedAt: "2026-08-24T10:00:00.000Z",
    reportDate: null,
    periodMonth: "2026-07-01",
    actualValue: null,
    budgetValue: null,
    isLegacyDeviation: true,
    recordedBy: null,
    ...overrides,
  };
}

describe("monthly STATISTIC reporting split", () => {
  it("keeps DAILY KPIs in daily items and MONTHLY STATISTIC out of daily", () => {
    const dailyStatistic = baseKpi({
      id: "daily-stat",
      name: "Körda mil",
      kind: "STATISTIC",
      reportingFrequency: "DAILY",
    });
    const dailyTarget = baseKpi({
      id: "daily-target",
      name: "Fyllnadsgrad",
      kind: "TARGET",
      status: "Gul",
      targetValue: "90",
      reportingFrequency: "DAILY",
    });
    const monthlyStatistic = baseKpi({
      id: "monthly-stat",
      name: "Energiförbrukning per månad",
      unit: "kWh",
      kind: "STATISTIC",
      reportingFrequency: "MONTHLY",
      category: "Energi",
    });
    const monthlyTarget = baseKpi({
      id: "monthly-target",
      name: "Resultat mot budget",
      kind: "TARGET",
      status: "Gul",
      unit: "Mkr",
      targetValue: "0",
      reportingFrequency: "MONTHLY",
      category: "Ekonomi",
    });

    const split = splitManualReportableKpis([
      dailyStatistic,
      dailyTarget,
      monthlyStatistic,
      monthlyTarget,
    ]);

    assert.deepEqual(
      split.daily.map((kpi) => kpi.id).sort(),
      ["daily-stat", "daily-target"],
    );
    assert.deepEqual(
      split.monthly.map((kpi) => kpi.id).sort(),
      ["monthly-stat", "monthly-target"],
    );
    assert.equal(isDailyManualReportableKpi(monthlyStatistic), false);
    assert.equal(isDailyManualReportableKpi(dailyStatistic), true);
    assert.equal(isMonthlyStatisticKpi(monthlyStatistic), true);
    assert.equal(isMonthlyEconomicTargetKpi(monthlyTarget), true);
    assert.equal(isMonthlyStatisticKpi(monthlyTarget), false);
  });

  it("treats STATISTIC as reported when value exists, without actual/budget", () => {
    const kpi = baseKpi({
      id: "energy",
      name: "Energiförbrukning per månad",
      unit: "kWh",
      reportingFrequency: "MONTHLY",
    });
    const row = history({
      kpiId: kpi.id,
      value: "1840",
      periodMonth: "2026-07-01",
      isLegacyDeviation: true,
    });
    const item = toMonthlyReportItem(
      kpi,
      "2026-07-01",
      new Map([[kpi.id, row]]),
      new Map(),
    );

    assert.equal(item.isReported, true);
    assert.equal(item.periodLabel, "Juli 2026");
    assert.equal(item.pendingLabel, null);
    assert.equal(item.expectedFinalizationLabel, null);
    assert.equal(item.actualValue, null);
    assert.equal(item.budgetValue, null);
    assert.equal(item.isLegacyDeviation, false);
    assert.equal(item.todayReport?.value, "1840");
  });

  it("does not mark unreported STATISTIC as awaiting closing", () => {
    const kpi = baseKpi({
      id: "offices",
      name: "Antal uthyrda kontor per månad",
      reportingFrequency: "MONTHLY",
    });
    const item = toMonthlyReportItem(kpi, "2026-08-01", new Map(), new Map());
    assert.equal(item.isReported, false);
    assert.equal(item.periodLabel, "Augusti 2026");
    assert.equal(item.pendingLabel, null);
    assert.equal(item.expectedFinalizationLabel, null);
  });

  it("keeps TARGET MONTHLY economic: actual+budget required and bokslut copy", () => {
    const kpi = baseKpi({
      id: "resultat",
      name: "Resultat mot budget",
      kind: "TARGET",
      status: "Gul",
      unit: "Mkr",
      targetValue: "0",
      reportingFrequency: "MONTHLY",
    });
    const unreported = toMonthlyReportItem(
      kpi,
      "2026-07-01",
      new Map(),
      new Map(),
    );
    assert.equal(unreported.isReported, false);
    assert.equal(unreported.periodLabel, "Juli");
    assert.equal(unreported.pendingLabel, "Inväntar bokslut");
    assert.match(unreported.expectedFinalizationLabel ?? "", /22 augusti/);

    const valueOnly = toMonthlyReportItem(
      kpi,
      "2026-07-01",
      new Map([
        [
          kpi.id,
          history({
            kpiId: kpi.id,
            value: "0,4",
            status: "Grön",
            actualValue: null,
            budgetValue: null,
          }),
        ],
      ]),
      new Map(),
    );
    assert.equal(valueOnly.isReported, false);

    const complete = toMonthlyReportItem(
      kpi,
      "2026-07-01",
      new Map([
        [
          kpi.id,
          history({
            kpiId: kpi.id,
            value: "0,4",
            status: "Grön",
            actualValue: "1,2",
            budgetValue: "0,8",
            isLegacyDeviation: false,
          }),
        ],
      ]),
      new Map(),
    );
    assert.equal(complete.isReported, true);
    assert.equal(complete.actualValue, "1,2");
    assert.equal(complete.budgetValue, "0,8");
    assert.equal(complete.pendingLabel, null);
  });

  it("labels the previous calendar month as Swedish month plus year", () => {
    assert.equal(monthlyStatisticPeriodLabel("2026-08-01"), "Augusti 2026");
    assert.equal(
      expectedResultPeriodMonth(new Date("2026-08-24T10:00:00Z")),
      "2026-07-01",
    );
    assert.equal(monthlyStatisticPeriodLabel("2026-07-01"), "Juli 2026");
  });
});
