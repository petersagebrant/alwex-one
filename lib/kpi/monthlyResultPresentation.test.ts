import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMonthlyResultAiContext,
  buildMonthlyResultPresentation,
} from "./monthlyResultPresentation";

describe("monthly result card presentation", () => {
  it("shows closing status and expected date before reporting", () => {
    assert.deepEqual(
      buildMonthlyResultPresentation({
        kpiName: "Resultat mot budget",
        unit: "Mkr",
        periodLabel: "Juli",
        isReported: false,
        pendingLabel: "Inväntar bokslut",
        expectedFinalizationLabel: "Förväntas omkring 22 augusti",
      }),
      {
        title: "Resultat mot budget – Juli",
        resultMonth: "Juli",
        pendingLabel: "Inväntar bokslut",
        expectedFinalizationLabel: "Förväntas omkring 22 augusti",
        actualValue: null,
        budgetValue: null,
        deviationValue: null,
        statusValue: null,
      },
    );
  });

  it("shows result, budget and computed deviation after reporting", () => {
    const presentation = buildMonthlyResultPresentation({
      kpiName: "Resultat mot budget",
      unit: "Mkr",
      periodLabel: "Juli",
      isReported: true,
      actualValue: "1,2",
      budgetValue: "0,8",
      status: "Grön",
    });

    assert.deepEqual(presentation, {
      title: "Resultat mot budget – Juli",
      resultMonth: "Juli",
      pendingLabel: null,
      expectedFinalizationLabel: null,
      actualValue: "1,2 Mkr",
      budgetValue: "0,8 Mkr",
      deviationValue: "+0,4 Mkr",
      statusValue: "Grön",
    });
    assert.equal("targetValue" in presentation, false);
  });

  it("keeps actual, budget, signed deviation and month distinct in AI context", () => {
    assert.deepEqual(
      buildMonthlyResultAiContext({
        name: "Resultat mot budget",
        reportingFrequency: "MONTHLY",
        latestPeriodMonth: "2026-07-01",
        expectedPeriodMonth: "2026-07-01",
        latestActualValue: "1,2",
        latestBudgetValue: "0,8",
        currentValue: "999",
        status: "Grön",
        isPeriodPending: false,
      }),
      {
        semanticRole: "latest_finalized_monthly_result",
        resultMonth: "2026-07-01",
        actualResult: "1,2",
        budgetResult: "0,8",
        deviation: "+0,4",
        status: "Grön",
        pendingClosing: false,
        expectedResultMonth: "2026-07-01",
        targetValue: null,
      },
    );
  });

  it("does not apply the target exception to unrelated monthly KPIs", () => {
    assert.equal(
      buildMonthlyResultAiContext({
        name: "Annan månads-KPI",
        reportingFrequency: "MONTHLY",
        currentValue: "5",
      }),
      null,
    );
  });
});
