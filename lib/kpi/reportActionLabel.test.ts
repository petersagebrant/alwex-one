import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dailyReportActionLabel } from "./reportActionLabel";

describe("dailyReportActionLabel", () => {
  it("prompts a new daily report when today's value is missing", () => {
    assert.equal(dailyReportActionLabel(false), "Rapportera");
  });

  it("offers correction when today's value is already reported", () => {
    assert.equal(dailyReportActionLabel(true), "Ändra");
  });
});
