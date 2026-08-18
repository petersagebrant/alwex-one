import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildMonthlyResultState,
  computeEconomicDeviation,
  formatMonthlyEconomicSummary,
} from "./economics";

const OPERATIONAL_AREAS = [
  "kyl-frys",
  "lager-logistik",
  "fjarr-miljo",
  "mark-anlaggning",
  "recycling",
  "intermodal",
  "frotradet",
] as const;

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260818180000_all_business_areas_shared_economic_kpis.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("shared economic rollout for every operational area", () => {
  for (const slug of OPERATIONAL_AREAS) {
    it(`${slug} uses the identical monthly result and pending model`, () => {
      assert.equal(computeEconomicDeviation("1,2", "0,8"), "0,4");
      const pending = buildMonthlyResultState({
        now: new Date("2026-08-18T10:00:00Z"),
        latestFinalizedPeriodMonth: null,
      });
      assert.equal(pending.expectedPeriodMonth, "2026-07-01");
      assert.equal(pending.isPending, true);
      assert.match(
        formatMonthlyEconomicSummary({
          periodMonth: pending.expectedPeriodMonth,
          unit: "Mkr",
        }),
        /Inväntar bokslut.*Förväntas omkring 22 augusti/,
      );
    });
  }

  it("migrates every non-synthetic area and excludes Alwex totalt", () => {
    assert.match(migration, /from public\.business_areas ba/);
    assert.match(migration, /ba\.slug <> 'alwex-totalt'/);
    assert.match(migration, /lower\(btrim\(ba\.name\)\) <> 'alwex totalt'/);
  });

  it("enforces one active shared trio without deleting legacy history", () => {
    assert.match(migration, /name = 'Resultat mot budget'/);
    assert.match(migration, /name in \('Omsättning idag', 'Omsättning'\)/);
    assert.match(migration, /name = 'Omsättning månad hittills'/);
    assert.match(migration, /calc_operator = 'MONTH_TO_DATE_SUM'/);
    assert.match(migration, /id <> v_result_id/);
    assert.match(migration, /id <> v_daily_id/);
    assert.doesNotMatch(migration, /delete\s+from\s+public\.(kpis|kpi_history)/i);
  });

  it("keeps legacy deviations operand-free while assigning a period", () => {
    assert.match(migration, /h\.period_month is null/);
    assert.doesNotMatch(
      migration,
      /set\s+(actual_value|budget_value)\s*=/i,
    );
  });
});
