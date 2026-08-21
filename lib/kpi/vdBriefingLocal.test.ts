import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLocalVdBriefing } from "./vdBriefingLocal";

describe("buildLocalVdBriefing", () => {
  it("does not treat unreported TARGET as yellow risk or according to plan", () => {
    const text = buildLocalVdBriefing({
      firstName: "Peter",
      summaryText: "",
      followUpKpis: [
        { name: "Sjukfrånvaro", area: "Kyl & Frys", status: "Gul", owner: "Anna" },
      ],
      greenAreaNames: [],
      actionGoals: [
        {
          goal: "Öka fyllnadsgrad i returflöden",
          area: "Kyl & Frys",
          status: "Gul",
          owner: "Anna",
        },
      ],
      reportedTargetCount: 0,
      unreportedTargetCount: 12,
      delayedActivityCount: 0,
      openDecisionCount: 0,
      positiveSummary:
        "Inga kritiska avvikelser — verksamheten ligger enligt plan.",
      analyzedAtLabel: "test",
    });

    assert.match(text, /rapporteringsbrist/i);
    assert.match(text, /Tillräckligt underlag saknas för positiv utveckling/);
    assert.match(text, /Tillräckligt underlag saknas för att bedöma tvåveckorsrisk/);
    assert.doesNotMatch(text, /enligt plan/);
    assert.doesNotMatch(text, /Sjukfrånvaro/);
    assert.doesNotMatch(text, /fyllnadsgrad/i);
    assert.doesNotMatch(text, /flera gula/);
  });

  it("still reports a real delayed activity as operational, separate from KPI status", () => {
    const text = buildLocalVdBriefing({
      firstName: "Peter",
      reportedTargetCount: 0,
      unreportedTargetCount: 5,
      delayedActivities: [{ title: "Byt däck", area: "Mark", owner: "Bo" }],
      delayedActivityCount: 1,
      analyzedAtLabel: "test",
    });
    assert.match(text, /Byt däck/);
    assert.match(text, /rapporteringsbrist/i);
    assert.doesNotMatch(text, /enligt plan/);
  });
});
