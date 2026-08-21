import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVdAssistant } from "./dashboard";

describe("buildVdAssistant reported-only briefing", () => {
  it("does not claim the operation is on plan when no TARGET is reported", () => {
    const result = buildVdAssistant({
      firstName: "Peter",
      areaCount: 7,
      greenKpiCount: 0,
      yellowKpiCount: 0,
      redKpiCount: 0,
      unreportedTargetCount: 21,
      delayedCount: 0,
      openDecisionCount: 0,
      greenAreaCount: 0,
      yellowAreaNames: [],
      redAreaNames: [],
      followUpKpis: [],
      topFollowUpKpi: null,
      yellowGoals: [{ title: "Öka fyllnadsgrad i returflöden", area: "Kyl & Frys" }],
    });

    assert.equal(result.riskLevel, "Ej bedömd");
    assert.match(result.situation, /ej rapporterade/i);
    assert.match(result.priority, /rapporteringsbrist/);
    assert.match(result.positiveSummary, /Tillräckligt underlag saknas/);
    assert.doesNotMatch(result.positiveSummary, /enligt plan/);
    assert.doesNotMatch(result.priority, /Inga kritiska avvikelser finns/);
    for (const line of result.observations) {
      assert.doesNotMatch(line, /fyllnadsgrad/i);
      assert.doesNotMatch(line, /gröna områden/);
    }
  });

  it("keeps according-to-plan language when reported TARGET KPIs are all green", () => {
    const result = buildVdAssistant({
      firstName: "Peter",
      areaCount: 2,
      greenKpiCount: 4,
      yellowKpiCount: 0,
      redKpiCount: 0,
      unreportedTargetCount: 0,
      delayedCount: 0,
      openDecisionCount: 0,
      greenAreaCount: 2,
      yellowAreaNames: [],
      redAreaNames: [],
      followUpKpis: [],
      topFollowUpKpi: null,
      yellowGoals: [],
    });
    assert.equal(result.riskLevel, "Låg");
    assert.match(result.positiveSummary, /enligt plan/);
  });
});
