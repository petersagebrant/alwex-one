import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPersonalGreeting,
  givenNameFromProfileFields,
  greetingTimeOfDay,
} from "./greeting";

describe("givenNameFromProfileFields", () => {
  it("uses the first token of display_name / full_name", () => {
    assert.equal(
      givenNameFromProfileFields({ displayName: "Peter Sagebrant" }),
      "Peter",
    );
    assert.equal(
      givenNameFromProfileFields({ displayName: "Lokal VD (granskning)" }),
      "Lokal",
    );
    assert.equal(
      givenNameFromProfileFields({ fullName: "Peter Sunesson" }),
      "Peter",
    );
    assert.equal(
      givenNameFromProfileFields({ name: "Anna" }),
      "Anna",
    );
  });

  it("prefers a proper name over an email token", () => {
    assert.equal(
      givenNameFromProfileFields({
        displayName: "Peter Sagebrant",
        email: "vd@example.com",
      }),
      "Peter",
    );
  });

  it("does not use role labels or vd-style email tokens as a given name", () => {
    assert.equal(givenNameFromProfileFields({ displayName: "Vd" }), null);
    assert.equal(givenNameFromProfileFields({ displayName: "VD" }), null);
    assert.equal(givenNameFromProfileFields({ name: "Vice VD" }), null);
    assert.equal(givenNameFromProfileFields({ email: "vd@example.com" }), null);
    assert.equal(
      givenNameFromProfileFields({ email: "vice.vd@example.com" }),
      null,
    );
  });

  it("falls back to a non-role email local-part when no name exists", () => {
    assert.equal(
      givenNameFromProfileFields({ email: "peter.sagebrant@example.com" }),
      "Peter",
    );
  });
});

describe("formatPersonalGreeting", () => {
  const morning = new Date("2026-09-09T06:15:00+02:00");
  const afternoon = new Date("2026-09-09T14:00:00+02:00");
  const evening = new Date("2026-09-09T20:30:00+02:00");

  it("greets with first name, not role", () => {
    assert.equal(formatPersonalGreeting("Peter Sagebrant", morning), "God morgon Peter.");
    assert.equal(formatPersonalGreeting("Peter", afternoon), "God dag Peter.");
    assert.doesNotMatch(formatPersonalGreeting("Peter", morning), /VD/);
    assert.equal(formatPersonalGreeting("Vd", morning), "God morgon.");
    assert.equal(formatPersonalGreeting(null, morning), "God morgon.");
    assert.doesNotMatch(formatPersonalGreeting("Vd", morning), /God morgon VD/);
  });

  it("uses Stockholm time of day", () => {
    assert.equal(greetingTimeOfDay(morning), "morgon");
    assert.equal(greetingTimeOfDay(afternoon), "dag");
    assert.equal(greetingTimeOfDay(evening), "kväll");
    assert.equal(formatPersonalGreeting("Peter", evening), "God kväll Peter.");
  });
});
