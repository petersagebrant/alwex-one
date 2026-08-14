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
    archivedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
    ...partial,
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
});
