import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNumeric } from "./parseNumeric";
import { hasValidKpiCurrentValue } from "./kind";
import {
  compareHistoryByCalendarDate,
  dailyReportDateRejectedReason,
  historyValueCalendarDate,
  isDailyReportDateNotFuture,
  parseIsoCalendarDate,
  resolveDailyReportDate,
  shouldUpdateKpiCurrentValue,
  stockholmCalendarDate,
  stockholmCalendarYesterday,
} from "./dailyReportDate";

describe("parseNumeric and missing vs zero", () => {
  it('treats "0" as a valid numeric value', () => {
    assert.equal(parseNumeric("0"), 0);
    assert.equal(parseNumeric("0,0"), 0);
    assert.equal(hasValidKpiCurrentValue("0"), true);
  });

  it("does not treat a missing value as 0", () => {
    assert.equal(parseNumeric(null), null);
    assert.equal(parseNumeric(undefined), null);
    assert.equal(parseNumeric(""), null);
    assert.equal(parseNumeric("  "), null);
    assert.equal(hasValidKpiCurrentValue(null), false);
    assert.equal(hasValidKpiCurrentValue(""), false);
    assert.notEqual(hasValidKpiCurrentValue(null), hasValidKpiCurrentValue("0"));
  });
});

describe("stockholmCalendarYesterday", () => {
  it("subtracts one Stockholm calendar day, not 86400000 ms", () => {
    // 25 Aug 2026 00:30 in Europe/Stockholm (UTC+2) = 24 Aug 22:30 UTC.
    const now = new Date("2026-08-24T22:30:00.000Z");
    assert.equal(stockholmCalendarDate(now), "2026-08-25");
    assert.equal(stockholmCalendarYesterday(now), "2026-08-24");
    assert.equal(
      new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
      "2026-08-23",
    );
  });

  it("crosses the year boundary on Stockholm New Year", () => {
    const now = new Date("2025-12-31T23:30:00.000Z"); // 1 Jan 2026 00:30 Stockholm
    assert.equal(stockholmCalendarDate(now), "2026-01-01");
    assert.equal(stockholmCalendarYesterday(now), "2025-12-31");
  });
});

describe("daily report date validation", () => {
  const now = new Date("2026-08-24T22:30:00.000Z"); // Stockholm 2026-08-25

  it("rejects invalid and future Stockholm dates", () => {
    assert.equal(parseIsoCalendarDate("2026-02-31"), null);
    assert.equal(parseIsoCalendarDate("25-08-2026"), null);
    assert.equal(isDailyReportDateNotFuture("2026-08-25", now), true);
    assert.equal(isDailyReportDateNotFuture("2026-08-24", now), true);
    assert.equal(isDailyReportDateNotFuture("2026-08-26", now), false);
    assert.equal(
      dailyReportDateRejectedReason("2026-08-26", now),
      "Rapportdatum kan inte vara i framtiden.",
    );
  });

  it("defaults invalid or future input to yesterday", () => {
    assert.equal(resolveDailyReportDate(undefined, now), "2026-08-24");
    assert.equal(resolveDailyReportDate("2026-08-26", now), "2026-08-24");
    assert.equal(resolveDailyReportDate("nope", now), "2026-08-24");
    assert.equal(resolveDailyReportDate("2026-08-20", now), "2026-08-20");
  });
});

describe("shouldUpdateKpiCurrentValue", () => {
  it("does not overwrite a newer snapshot with a backdated day", () => {
    assert.equal(shouldUpdateKpiCurrentValue("2026-08-20", "2026-08-24"), false);
    assert.equal(shouldUpdateKpiCurrentValue("2026-08-24", "2026-08-24"), true);
    assert.equal(shouldUpdateKpiCurrentValue("2026-08-25", "2026-08-24"), true);
    assert.equal(shouldUpdateKpiCurrentValue("2026-08-20", null), true);
  });
});

describe("history calendar date fallback", () => {
  it("prefers reportDate and falls back when it is null", () => {
    assert.equal(
      historyValueCalendarDate({
        reportDate: "2026-08-20",
        recordedAt: "2026-08-25T09:00:00.000Z",
      }),
      "2026-08-20",
    );
    assert.equal(
      historyValueCalendarDate({
        reportDate: null,
        recordedAt: "2026-08-25T09:00:00.000Z",
      }),
      "2026-08-25",
    );
    const older = {
      reportDate: "2026-08-20",
      recordedAt: "2026-08-25T12:00:00.000Z",
    };
    const newer = {
      reportDate: "2026-08-24",
      recordedAt: "2026-08-24T08:00:00.000Z",
    };
    assert.ok(compareHistoryByCalendarDate(older, newer) < 0);
  });
});
