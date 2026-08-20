import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateSv, formatDateTimeSv } from "./date";

describe("formatDateSv", () => {
  it("formats a valid ISO date-only value without shifting the calendar day", () => {
    assert.equal(formatDateSv("2026-08-18"), "18 aug. 2026");
  });

  it("formats a Postgres timestamptz string instead of concatenating T12:00:00", () => {
    assert.equal(
      formatDateSv("2026-08-18 17:50:21.699048+00"),
      "18 aug. 2026",
    );
  });

  it("formats a valid ISO datetime", () => {
    assert.equal(formatDateSv("2026-08-18T17:50:21.699048+00:00"), "18 aug. 2026");
  });

  it("does not throw for missing or invalid values", () => {
    assert.equal(formatDateSv(""), "—");
    assert.equal(formatDateSv("   "), "—");
    assert.equal(formatDateSv("not-a-date"), "—");
    assert.equal(formatDateSv("2026-08-18 17:50:21.699048+00T12:00:00"), "—");
  });
});

describe("formatDateTimeSv", () => {
  it("formats a valid ISO datetime", () => {
    assert.match(
      formatDateTimeSv("2026-08-18T17:50:21.699048+00:00"),
      /18 aug\. 2026/,
    );
  });

  it("does not throw for missing or invalid values", () => {
    assert.equal(formatDateTimeSv(""), "—");
    assert.equal(formatDateTimeSv("not-a-date"), "—");
  });
});
