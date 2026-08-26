import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aoEconomicPictureHeading,
  buildAoEconomicCards,
  buildMonthlyEconomicPicture,
  buildMonthlyResultAiContext,
  buildMonthlyResultPresentation,
  isHiddenFromAreaKpiList,
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
        periodMonth: "2026-07-01",
        resultMonth: "2026-07-01",
        actualResult: "1,2",
        budgetResult: "0,8",
        deviation: "+0,4",
        resultDeviationPercent: "+50 %",
        actualRevenue: null,
        budgetRevenue: null,
        revenueDeviation: null,
        revenueDeviationPercent: null,
        margin: null,
        ytdResultActual: null,
        ytdResultBudget: null,
        ytdRevenueActual: null,
        ytdRevenueBudget: null,
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

  it("extends AI context with revenue, margin and YTD on the same period_month", () => {
    const context = buildMonthlyResultAiContext({
      name: "Resultat mot budget",
      reportingFrequency: "MONTHLY",
      latestPeriodMonth: "2026-07-01",
      expectedPeriodMonth: "2026-07-01",
      latestActualValue: "1,2",
      latestBudgetValue: "0,8",
      revenueActualValue: "10",
      revenueBudgetValue: "9",
      status: "Grön",
      isPeriodPending: false,
      resultHistory: [
        { periodMonth: "2026-06-01", actualValue: "0,5", budgetValue: "0,6" },
        { periodMonth: "2026-07-01", actualValue: "1,2", budgetValue: "0,8" },
      ],
    });
    assert.equal(context?.semanticRole, "latest_finalized_monthly_result");
    assert.equal(context?.periodMonth, "2026-07-01");
    assert.equal(context?.actualRevenue, "10");
    assert.equal(context?.budgetRevenue, "9");
    assert.equal(context?.revenueDeviation, "+1");
    assert.equal(context?.margin, "12,0 %");
    assert.equal(context?.ytdResultActual, "1,7");
    assert.equal(context?.ytdResultBudget, "1,4");
    assert.equal(context?.ytdRevenueActual, null);
    assert.equal(context?.ytdRevenueBudget, null);
  });

  it("uses monthly revenue vs budget semantic role for the sibling KPI", () => {
    const context = buildMonthlyResultAiContext({
      name: "Omsättning mot budget",
      reportingFrequency: "MONTHLY",
      latestPeriodMonth: "2026-07-01",
      latestActualValue: "10",
      latestBudgetValue: "9",
      status: "Grön",
      isPeriodPending: false,
      resultHistory: [
        { periodMonth: "2026-06-01", actualValue: "9", budgetValue: "8,5" },
        { periodMonth: "2026-07-01", actualValue: "10", budgetValue: "9" },
      ],
    });
    assert.equal(
      context?.semanticRole,
      "latest_finalized_monthly_revenue_vs_budget",
    );
    assert.equal(context?.periodMonth, "2026-07-01");
    assert.equal(context?.actualRevenue, "10");
    assert.equal(context?.actualResult, null);
    assert.equal(context?.ytdRevenueActual, "19");
    assert.equal(context?.ytdRevenueBudget, "17,5");
  });

  it("composes the monthly economic picture with auto formulas", () => {
    const picture = buildMonthlyEconomicPicture({
      periodMonth: "2026-07-01",
      unit: "Mkr",
      result: {
        actualValue: "1,2",
        budgetValue: "0,8",
        status: "Grön",
        isReported: true,
      },
      revenue: {
        actualValue: "10",
        budgetValue: "9",
        status: "Grön",
        isReported: true,
      },
      resultHistory: [
        { periodMonth: "2026-06-01", actualValue: "0,5", budgetValue: "0,6" },
        { periodMonth: "2026-07-01", actualValue: "1,2", budgetValue: "0,8" },
      ],
      revenueHistory: [
        { periodMonth: "2026-06-01", actualValue: "9", budgetValue: "8,5" },
        { periodMonth: "2026-07-01", actualValue: "10", budgetValue: "9" },
      ],
      resultHref: "/kpis/resultat",
    });
    assert.equal(picture.periodLabel, "Juli 2026");
    assert.equal(picture.result.deviationValue, "+0,4 Mkr");
    assert.equal(picture.result.deviationPercent, "+50 %");
    assert.equal(picture.revenue.actualValue, "10 Mkr");
    assert.equal(picture.margin, "12,0 %");
    assert.equal(picture.ytdResultActual, "1,7 Mkr");
    assert.equal(picture.ytdResultBudget, "1,4 Mkr");
    assert.equal(picture.ytdResult.deviationValue, "+0,3 Mkr");
    assert.equal(picture.ytdRevenue.actualValue, "19 Mkr");
    assert.equal(picture.ytdRevenue.budgetValue, "17,5 Mkr");
    assert.equal(picture.ytdRevenue.deviationValue, "+1,5 Mkr");
    assert.equal(picture.resultHref, "/kpis/resultat");
  });

  it("shows 1,1 / 12,4 result margin as 8,9 % on the picture and AO cards", () => {
    const picture = buildMonthlyEconomicPicture({
      periodMonth: "2026-07-01",
      unit: "Mkr",
      result: {
        actualValue: "1,1",
        budgetValue: "0,8",
        isReported: true,
      },
      revenue: {
        actualValue: "12,4",
        budgetValue: "12,0",
        isReported: true,
      },
    });
    assert.equal(picture.margin, "8,9 %");
    assert.notEqual(picture.margin, "8,871 %");
    assert.notEqual(picture.margin, "+887 %");
    const cards = buildAoEconomicCards(picture);
    assert.equal(cards[2]?.percentValue, "8,9 %");
  });

  it("keeps percent and YTD revenue on the picture while AO cards omit them", () => {
    const picture = buildMonthlyEconomicPicture({
      periodMonth: "2026-07-01",
      unit: "Mkr",
      result: {
        actualValue: "1,2",
        budgetValue: "0,8",
        isReported: true,
      },
      revenue: {
        actualValue: "10",
        budgetValue: "9",
        isReported: true,
      },
      resultHistory: [
        { periodMonth: "2026-06-01", actualValue: "0,5", budgetValue: "0,6" },
        { periodMonth: "2026-07-01", actualValue: "1,2", budgetValue: "0,8" },
      ],
      revenueHistory: [
        { periodMonth: "2026-06-01", actualValue: "9", budgetValue: "8,5" },
        { periodMonth: "2026-07-01", actualValue: "10", budgetValue: "9" },
      ],
    });
    assert.equal(picture.result.deviationPercent, "+50 %");
    assert.equal(picture.revenue.deviationPercent, "+11,111 %");
    assert.equal(picture.ytdRevenue.actualValue, "19 Mkr");
    assert.equal(
      aoEconomicPictureHeading(picture.periodMonth),
      "Månadens ekonomiska bild – juli 2026",
    );
    const cards = buildAoEconomicCards(picture);
    assert.deepEqual(
      cards.map((card) => card.title),
      [
        "Omsättning",
        "Resultat",
        "Resultatmarginal",
        "Ackumulerat resultat",
      ],
    );
    assert.equal(cards[0]?.actualValue, "10 Mkr");
    assert.equal(cards[0]?.budgetValue, "9 Mkr");
    assert.equal(cards[0]?.deviationValue, "+1 Mkr");
    assert.equal(cards[0]?.percentValue, null);
    assert.equal(cards[0]?.helperText, null);
    assert.equal(cards[1]?.actualValue, "1,2 Mkr");
    assert.equal(cards[1]?.deviationValue, "+0,4 Mkr");
    assert.equal(cards[2]?.percentValue, "12,0 %");
    assert.equal(cards[3]?.title, "Ackumulerat resultat");
    assert.equal(cards[3]?.helperText, "Resultat från årets början");
    assert.equal(cards[3]?.actualValue, "1,7 Mkr");
    assert.equal(cards[3]?.budgetValue, "1,4 Mkr");
    assert.equal(cards[3]?.deviationValue, "+0,3 Mkr");
    assert.equal(
      cards.some((card) => /YTD/i.test(`${card.title} ${card.helperText ?? ""}`)),
      false,
    );
    assert.equal(
      cards.some((card) => card.title.includes("omsättning") || card.title.includes("Omsättningsavvikelse")),
      false,
    );
    assert.equal(
      cards.some((card) => /ackumulerad omsättning/i.test(card.title)),
      false,
    );
  });

  it("hides monthly economic KPIs from the ordinary AO list without deleting them", () => {
    assert.equal(
      isHiddenFromAreaKpiList({
        name: "Resultat mot budget",
        reportingFrequency: "MONTHLY",
      }),
      true,
    );
    assert.equal(
      isHiddenFromAreaKpiList({
        name: "Omsättning mot budget",
        reportingFrequency: "MONTHLY",
      }),
      true,
    );
    assert.equal(
      isHiddenFromAreaKpiList({
        name: "Sjukfrånvaro",
        reportingFrequency: "MONTHLY",
      }),
      false,
    );
  });
});
