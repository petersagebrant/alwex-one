import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectBatchDailyReports,
  dailyKpiValidationKpiFromKpi,
  EMPTY_DAILY_BATCH_MESSAGE,
  formatBatchDailyReportError,
  isSkippedDailyReportValue,
  prepareDailyKpiReport,
  selectPreviousDailyHistoryEntry,
  type DailyKpiValidationKpi,
} from "./dailyKpiReport";

function statistic(id: string, name: string): DailyKpiValidationKpi {
  return dailyKpiValidationKpiFromKpi({
    id,
    name,
    businessAreaId: "area-1",
    kind: "STATISTIC",
    calcOperator: null,
    reportingFrequency: "DAILY",
  });
}

function manualTarget(id: string, name: string): DailyKpiValidationKpi {
  return dailyKpiValidationKpiFromKpi({
    id,
    name,
    businessAreaId: "area-1",
    kind: "TARGET",
    calcOperator: null,
    reportingFrequency: "DAILY",
    direction: null,
    targetValue: "10",
  });
}

const sjuktimmar = statistic("num", "Sjuktimmar");
const ordinarie = statistic("den", "Ordinarie timmar");
const sjukfranvaro: DailyKpiValidationKpi = dailyKpiValidationKpiFromKpi({
  id: "pct",
  name: "Sjukfrånvaro",
  businessAreaId: "area-1",
  kind: "TARGET",
  calcOperator: "RATIO_PERCENT",
  reportingFrequency: "DAILY",
  calcNumeratorKpiId: "num",
  calcDenominatorKpiId: "den",
  ratioReportingMode: "GROUPED",
  direction: "LOWER_IS_BETTER",
  toleranceType: "ABSOLUTE",
  yellowTolerance: 1,
  targetValue: "5",
});
const leverans = manualTarget("lev", "Leveransprecision");

describe("selectPreviousDailyHistoryEntry", () => {
  it("picks the latest report_date strictly before the selected date when backdating", () => {
    const history = [
      { reportDate: "2026-08-24", value: "later" },
      { reportDate: "2026-08-20", value: "previous" },
      { reportDate: "2026-08-18", value: "older" },
    ];
    const previous = selectPreviousDailyHistoryEntry(history, "2026-08-21");
    assert.equal(previous?.value, "previous");
    assert.equal(previous?.reportDate, "2026-08-20");
  });

  it("does not treat a later date or current_value as previous", () => {
    const history = [
      { reportDate: "2026-08-24", value: "current-snapshot" },
      { reportDate: "2026-08-10", value: "real-previous" },
    ];
    const previous = selectPreviousDailyHistoryEntry(history, "2026-08-20");
    assert.equal(previous?.value, "real-previous");
    assert.notEqual(previous?.value, "current-snapshot");
  });

  it("returns null when no earlier dated row exists", () => {
    assert.equal(
      selectPreviousDailyHistoryEntry(
        [{ reportDate: "2026-08-24", value: "later" }],
        "2026-08-20",
      ),
      null,
    );
    assert.equal(
      selectPreviousDailyHistoryEntry(
        [{ reportDate: null, value: "undated" }],
        "2026-08-20",
      ),
      null,
    );
  });
});

describe("empty skip vs 0 save", () => {
  it("skips empty and whitespace, but treats 0 as a value", () => {
    assert.equal(isSkippedDailyReportValue(""), true);
    assert.equal(isSkippedDailyReportValue("  "), true);
    assert.equal(isSkippedDailyReportValue(null), true);
    assert.equal(isSkippedDailyReportValue("0"), false);
    assert.equal(isSkippedDailyReportValue("0,0"), false);
    assert.equal(isSkippedDailyReportValue(" 0 "), false);
  });

  it("batch: empty fields are omitted, 0 is prepared for save", () => {
    const result = collectBatchDailyReports({
      reportDate: "2026-08-24",
      kpis: [leverans, statistic("ton", "Ton idag")],
      drafts: [
        { kpiId: "lev", value: "  ", status: "Grön" },
        { kpiId: "ton", value: "0", status: "Statistik" },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reports.length, 1);
    assert.equal(result.reports[0]?.kpiId, "ton");
    assert.equal(result.reports[0]?.value, "0");
  });

  it("batch: 0,0 is saved for a statistic KPI", () => {
    const result = collectBatchDailyReports({
      reportDate: "2026-08-24",
      kpis: [statistic("ton", "Ton idag")],
      drafts: [{ kpiId: "ton", value: "0,0", status: "Statistik" }],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.reports.map((row) => row.value),
      ["0,0"],
    );
  });
});

describe("TARGET comment abort", () => {
  it("requires a comment for manual TARGET Gul/Röd", () => {
    const prepared = prepareDailyKpiReport(leverans, {
      value: "4",
      status: "Gul",
      comment: "",
      reportDate: "2026-08-24",
    });
    assert.equal(prepared.ok, false);
    if (prepared.ok) return;
    assert.equal(prepared.error, "Beskriv kort varför KPI:n avviker.");
  });

  it("aborts the entire batch and lists the TARGET name", () => {
    const result = collectBatchDailyReports({
      reportDate: "2026-08-24",
      kpis: [leverans, statistic("ton", "Ton idag")],
      drafts: [
        { kpiId: "lev", value: "4", status: "Röd", comment: "" },
        { kpiId: "ton", value: "12", status: "Statistik" },
      ],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(result.kpiNames, ["Leveransprecision"]);
    assert.match(
      formatBatchDailyReportError(result.kpiNames),
      /Leveransprecision/,
    );
  });

  it("does not require a comment on calculated ratio percent", () => {
    const prepared = prepareDailyKpiReport(sjukfranvaro, {
      value: "8",
      status: "Röd",
      comment: "",
      reportDate: "2026-08-24",
    });
    assert.equal(prepared.ok, false);
    if (prepared.ok) return;
    assert.equal(prepared.error, "Beräknade KPI:er rapporteras inte manuellt.");
  });
});

describe("GROUPED pair abort", () => {
  const groupedKpis = [sjuktimmar, ordinarie, sjukfranvaro, leverans];

  it("skips when both sjuk fields are empty", () => {
    const result = collectBatchDailyReports({
      reportDate: "2026-08-24",
      kpis: groupedKpis,
      drafts: [
        { kpiId: "num", value: "", status: "Statistik" },
        { kpiId: "den", value: "  ", status: "Statistik" },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.reports, []);
  });

  it("aborts the entire save when only one sjuk field is filled", () => {
    const result = collectBatchDailyReports({
      reportDate: "2026-08-24",
      kpis: groupedKpis,
      drafts: [
        { kpiId: "num", value: "2", status: "Statistik" },
        { kpiId: "den", value: "", status: "Statistik" },
        { kpiId: "lev", value: "10", status: "Grön" },
      ],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(result.kpiNames, ["Sjuktimmar", "Ordinarie timmar"]);
  });

  it("saves both sjuk fields when both are filled, including 0", () => {
    const result = collectBatchDailyReports({
      reportDate: "2026-08-24",
      kpis: groupedKpis,
      drafts: [
        { kpiId: "num", value: "0", status: "Statistik" },
        { kpiId: "den", value: "0,0", status: "Statistik" },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reports.length, 2);
    assert.deepEqual(
      result.reports.map((row) => row.kpiId).sort(),
      ["den", "num"],
    );
  });

  it("does not group SEPARATE_INPUTS sjuk; each field skips independently", () => {
    const separate = {
      ...sjukfranvaro,
      ratioReportingMode: "SEPARATE_INPUTS" as const,
    };
    const result = collectBatchDailyReports({
      reportDate: "2026-08-24",
      kpis: [sjuktimmar, ordinarie, separate],
      drafts: [
        { kpiId: "num", value: "3", status: "Statistik" },
        { kpiId: "den", value: "", status: "Statistik" },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.reports.length, 1);
    assert.equal(result.reports[0]?.kpiId, "num");
  });
});

describe("empty batch message", () => {
  it("keeps the empty-save copy", () => {
    assert.equal(EMPTY_DAILY_BATCH_MESSAGE, "Inget att spara.");
  });
});
