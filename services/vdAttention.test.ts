import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVdAttentionItems } from "./vdAttention";
import type { KPIListItem } from "@/services/kpis";

function kpi(partial: Partial<KPIListItem> & Pick<KPIListItem, "id" | "name">): KPIListItem {
  return {
    businessAreaId: partial.businessAreaId ?? "area-1",
    businessAreaName: partial.businessAreaName ?? "Kyl & Frys",
    category: null,
    targetValue: partial.targetValue ?? "3",
    currentValue: partial.currentValue ?? "8",
    unit: partial.unit ?? "%",
    status: partial.status ?? "Röd",
    trend: partial.trend ?? "Ner",
    kind: partial.kind ?? "TARGET",
    direction: partial.direction ?? "LOWER_IS_BETTER",
    toleranceType: partial.toleranceType ?? "ABSOLUTE",
    greenTolerance: null,
    yellowTolerance: 1,
    calcOperator: partial.calcOperator ?? null,
    calcNumeratorKpiId: null,
    calcDenominatorKpiId: null,
    reportingFrequency: partial.reportingFrequency ?? "DAILY",
    archivedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
    ...partial,
    ratioReportingMode: partial.ratioReportingMode ?? "GROUPED",
  };
}

describe("buildVdAttentionItems sjukfrånvaro filter", () => {
  it("excludes per-AO RATIO_PERCENT but keeps company WEIGHTED_RATIO_PERCENT", () => {
    const items = buildVdAttentionItems({
      kpis: [
        kpi({
          id: "ao-sick",
          name: "Sjukfrånvaro",
          businessAreaName: "Kyl & Frys",
          calcOperator: "RATIO_PERCENT",
          status: "Röd",
          currentValue: "8",
          targetValue: "3",
        }),
        kpi({
          id: "company-sick",
          name: "Sjukfrånvaro Alwex totalt",
          businessAreaId: "alwex-totalt",
          businessAreaName: "Alwex totalt",
          calcOperator: "WEIGHTED_RATIO_PERCENT",
          status: "Röd",
          currentValue: "6",
          targetValue: "3",
        }),
        kpi({
          id: "other",
          name: "Beläggning",
          businessAreaName: "Kyl & Frys",
          calcOperator: null,
          status: "Röd",
          currentValue: "70",
          targetValue: "90",
          unit: "%",
        }),
      ],
      delayedActivities: [],
      openDecisions: [],
      areas: [],
      areaManagers: new Map(),
      limit: 10,
    });

    const titles = items.map((item) => item.title);
    assert.ok(titles.includes("Sjukfrånvaro Alwex totalt"));
    assert.ok(titles.includes("Beläggning"));
    assert.ok(!titles.includes("Sjukfrånvaro"));
  });

  it("never alerts on a pending monthly result and period-labels finalized results", () => {
    const pending = kpi({
      id: "pending-result",
      name: "Resultat mot budget",
      reportingFrequency: "MONTHLY",
      isPeriodPending: true,
      expectedPeriodMonth: "2026-07-01",
      latestPeriodMonth: "2026-06-01",
      status: "Röd",
      currentValue: "-1",
      latestActualValue: "0",
      latestBudgetValue: "1",
      targetValue: "0",
      unit: "Mkr",
    });
    const finalized = kpi({
      id: "final-result",
      name: "Resultat mot budget",
      reportingFrequency: "MONTHLY",
      isPeriodPending: false,
      latestPeriodMonth: "2026-07-01",
      status: "Röd",
      currentValue: "-1",
      latestActualValue: "0",
      latestBudgetValue: "1",
      targetValue: "0",
      unit: "Mkr",
    });
    const items = buildVdAttentionItems({
      kpis: [pending, finalized],
      delayedActivities: [],
      openDecisions: [],
      areas: [],
      areaManagers: new Map(),
      limit: 10,
    });
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Resultat mot budget – Juli");
    assert.match(
      items[0]?.metrics ?? "",
      /Resultatmånad: Juli 2026\. Faktiskt resultat: 0 Mkr\. Budgeterat resultat: 1 Mkr\. Avvikelse: -1 Mkr\. Status: Röd/,
    );
    assert.doesNotMatch(items[0]?.metrics ?? "", /mål 0/i);
  });

  it("includes a red system-computed Lager productivity TARGET", () => {
    const items = buildVdAttentionItems({
      kpis: [
        kpi({
          id: "lager-productivity",
          name: "Kolli per arbetad timme",
          businessAreaName: "Lager & Logistik",
          calcOperator: "SUM_DIVIDE",
          direction: "HIGHER_IS_BETTER",
          status: "Röd",
          currentValue: "20",
          targetValue: "100",
          unit: "kolli/timme",
        }),
      ],
      delayedActivities: [],
      openDecisions: [],
      areas: [],
      areaManagers: new Map(),
      limit: 10,
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Kolli per arbetad timme");
    assert.match(items[0]?.metrics ?? "", /20 kolli\/timme mot mål 100/);
  });

  it("does not treat unreported TARGET or stored area Gul/Röd as attention", () => {
    const items = buildVdAttentionItems({
      kpis: [
        kpi({
          id: "stale-red",
          name: "Beläggning",
          status: "Röd",
          currentValue: null,
        }),
      ],
      delayedActivities: [],
      openDecisions: [],
      areas: [
        {
          id: "area-1",
          name: "Kyl & Frys",
          slug: "kyl-frys",
          manager: "Anna",
          status: "Röd",
        },
      ],
      areaManagers: new Map([["area-1", "Anna"]]),
      limit: 10,
    });
    assert.equal(items.length, 0);
  });

  it("flags a red area from reported TARGET even when stored area status is Gul", () => {
    const items = buildVdAttentionItems({
      kpis: [
        kpi({
          id: "sick",
          name: "Sjukfrånvaro",
          status: "Röd",
          currentValue: "8,2",
          calcOperator: "RATIO_PERCENT",
        }),
      ],
      delayedActivities: [],
      openDecisions: [],
      areas: [
        {
          id: "area-1",
          name: "Kyl & Frys",
          slug: "kyl-frys",
          manager: "Anna",
          status: "Gul",
        },
      ],
      areaManagers: new Map([["area-1", "Anna"]]),
      limit: 10,
    });
    const areaItem = items.find((item) => item.type === "Affärsområde");
    assert.equal(areaItem?.title, "Kyl & Frys");
    assert.equal(areaItem?.statusLabel, "Röd");
    assert.ok(!items.some((item) => item.type === "KPI"));
  });
});
