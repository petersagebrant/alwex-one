import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { computeKpiStatus } from "./computeStatus";
import {
  dailyKpiValidationKpiFromKpi,
  prepareDailyKpiReport,
} from "./dailyKpiReport";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260910190000_intermodal_operational_kpi_auto_status.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Intermodal operational KPI auto-status", () => {
  it("scopes to intermodal by slug and fails if the area is missing", () => {
    assert.match(migration, /where ba\.slug = 'intermodal'/);
    assert.match(migration, /Intermodal business area not found/);
    assert.doesNotMatch(
      migration,
      /slug = '(kyl-frys|lager-logistik|fjarr-miljo|mark-anlaggning|recycling|frotradet|alwex-totalt)'/,
    );
  });

  it("updates the two existing TARGET KPIs in place without insert or delete", () => {
    assert.match(migration, /and name = 'Leveransprecision'/);
    assert.match(migration, /and name = 'Beläggning tågpendlar'/);
    assert.match(migration, /direction = 'HIGHER_IS_BETTER'/);
    assert.match(migration, /tolerance_type = 'ABSOLUTE'/);
    assert.doesNotMatch(migration, /insert into public\.(kpis|kpi_history)/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
    assert.doesNotMatch(migration, /update\s+public\.kpi_history/i);
    assert.doesNotMatch(migration, /target_value\s*=/);
    assert.doesNotMatch(migration, /and name = 'Övertid'/);
    assert.doesNotMatch(migration, /and name = 'Sjukfrånvaro'/);
    assert.doesNotMatch(migration, /and name = 'Sjuktimmar'/);
    assert.doesNotMatch(migration, /and name = 'Ordinarie arbetstid'/);
  });

  it("sets HIGHER_IS_BETTER ABSOLUTE bands 98.5/1.5 and 85/5", () => {
    assert.match(migration, /yellow_tolerance = 1\.5/);
    assert.match(migration, /yellow_tolerance = 5/);
    assert.match(migration, /public\.compute_kpi_status_sql/);
    assert.match(migration, /public\.parse_kpi_numeric_text\(current_value\)/);
    assert.match(migration, /public\.parse_kpi_numeric_text\(target_value\)/);

    const leverans = (value: number) =>
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        yellowTolerance: 1.5,
        target: 98.5,
        value,
      });

    assert.equal(leverans(98.5), "Grön");
    assert.equal(leverans(98.9), "Grön");
    assert.equal(leverans(97.0), "Gul");
    assert.equal(leverans(96.9), "Röd");

    const belaggning = (value: number) =>
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        yellowTolerance: 5,
        target: 85,
        value,
      });

    assert.equal(belaggning(85), "Grön");
    assert.equal(belaggning(82), "Gul");
    assert.equal(belaggning(80), "Gul");
    assert.equal(belaggning(79.9), "Röd");
  });

  it("still requires a comment when auto-status is Gul or Röd", () => {
    const kpi = dailyKpiValidationKpiFromKpi({
      id: "intermodal-leverans",
      name: "Leveransprecision",
      businessAreaId: "intermodal",
      kind: "TARGET",
      calcOperator: null,
      reportingFrequency: "DAILY",
      direction: "HIGHER_IS_BETTER",
      toleranceType: "ABSOLUTE",
      yellowTolerance: 1.5,
      targetValue: "98,5",
    });

    const yellowWithoutComment = prepareDailyKpiReport(kpi, {
      value: "97,0",
      status: "Gul",
      comment: "",
      reportDate: "2026-09-10",
    });
    assert.equal(yellowWithoutComment.ok, false);
    if (!yellowWithoutComment.ok) {
      assert.equal(yellowWithoutComment.error, "Beskriv kort varför KPI:n avviker.");
    }

    const yellowWithComment = prepareDailyKpiReport(kpi, {
      value: "97,0",
      status: "Gul",
      comment: "Försening i växling.",
      reportDate: "2026-09-10",
    });
    assert.equal(yellowWithComment.ok, true);
    if (yellowWithComment.ok) {
      assert.equal(yellowWithComment.value.status, "Gul");
    }
  });
});
