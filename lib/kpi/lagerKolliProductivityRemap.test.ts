import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { computeKpiStatus } from "./computeStatus";
import {
  isDailyManualReportableKpi,
  isSystemComputedKpi,
} from "./kind";
import {
  dailyKpiValidationKpiFromKpi,
  prepareDailyKpiReport,
} from "./dailyKpiReport";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260911150000_lager_kolli_productivity_remap.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Lager & Logistik Kolli productivity remap", () => {
  it("scopes to lager-logistik by slug and fails if the area is missing", () => {
    assert.match(migration, /where ba\.slug = 'lager-logistik'/);
    assert.match(migration, /Lager & Logistik business area not found/);
    assert.doesNotMatch(
      migration,
      /slug = '(kyl-frys|fjarr-miljo|mark-anlaggning|intermodal|recycling|frotradet|alwex-totalt)'/,
    );
    assert.doesNotMatch(migration, /Ordinarie arbetstid|Beläggningsgrad|Övertid/);
  });

  it("unarchives only hours and productivity without touching OOH or Byggmax", () => {
    assert.match(migration, /'Arbetade timmar'/);
    assert.match(migration, /'Kolli per arbetad timme'/);
    assert.match(migration, /'Kolli OOH'/);
    assert.match(migration, /'Kolli Byggmax'/);
    assert.match(migration, /Kolli OOH must remain archived/);
    assert.match(migration, /Kolli Byggmax must remain archived/);
    assert.match(
      migration,
      /foreach v_name in array array\[\s*'Arbetade timmar',\s*'Kolli per arbetad timme'\s*\]/,
    );
    assert.match(migration, /set archived_at = null/);
    assert.match(
      migration,
      /disable trigger kpis_prevent_unauthorized_archive/,
    );
    assert.match(
      migration,
      /enable trigger kpis_prevent_unauthorized_archive/,
    );
    assert.doesNotMatch(migration, /insert into public\.kpis/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\.(kpis|kpi_history)/i);
    assert.doesNotMatch(migration, /insert into public\.kpi_history/i);
    assert.doesNotMatch(migration, /update\s+public\.kpi_history/i);
  });

  it("remaps SUM_DIVIDE to Kolli / Arbetade timmar and freezes old history", () => {
    assert.match(migration, /k\.name = 'Kolli'/);
    assert.match(migration, /array\['Kolli'\]/);
    assert.match(migration, /delete from public\.kpi_calc_sum_numerators/);
    assert.match(
      migration,
      /insert into public\.kpi_calc_sum_numerators/,
    );
    assert.match(
      migration,
      /values \(v_productivity_id, v_kolli_id, 1\)/,
    );
    assert.match(
      migration,
      /denominator is not Arbetade timmar/,
    );
    assert.match(migration, /target_value = '100'/);
    assert.match(migration, /direction = 'HIGHER_IS_BETTER'/);
    assert.match(migration, /yellow_tolerance = 10/);
    assert.match(
      migration,
      /v_cutover date := \(now\(\) at time zone 'Europe\/Stockholm'\)::date/,
    );
    assert.match(migration, /calc_effective_from = v_cutover/);
    assert.match(migration, /Do not rewrite old kpi_history rows/);
    assert.doesNotMatch(migration, /set\s+target_value/);
    assert.doesNotMatch(migration, /set\s+yellow_tolerance/);
    assert.doesNotMatch(migration, /set\s+direction/);
  });

  it("keeps Kolli and hours manual and productivity system-computed", () => {
    assert.equal(
      isDailyManualReportableKpi({
        kind: "STATISTIC",
        calcOperator: null,
        reportingFrequency: "DAILY",
      }),
      true,
    );
    assert.equal(
      isSystemComputedKpi({
        kind: "TARGET",
        calcOperator: "SUM_DIVIDE",
      }),
      true,
    );
    assert.equal(
      isDailyManualReportableKpi({
        kind: "TARGET",
        calcOperator: "SUM_DIVIDE",
        reportingFrequency: "DAILY",
      }),
      false,
    );

    const productivity = dailyKpiValidationKpiFromKpi({
      id: "lager-productivity",
      name: "Kolli per arbetad timme",
      businessAreaId: "lager-logistik",
      kind: "TARGET",
      calcOperator: "SUM_DIVIDE",
      reportingFrequency: "DAILY",
      direction: "HIGHER_IS_BETTER",
      toleranceType: "ABSOLUTE",
      yellowTolerance: 10,
      targetValue: "100",
    });
    const rejected = prepareDailyKpiReport(productivity, {
      value: "50",
      status: "Röd",
      comment: "",
      reportDate: "2026-09-11",
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.match(rejected.error, /Beräknade KPI:er rapporteras inte manuellt/);
    }

    assert.equal(
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        yellowTolerance: 10,
        value: "50",
        target: "100",
      }),
      "Röd",
    );
    assert.equal(
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        yellowTolerance: 10,
        value: "100",
        target: "100",
      }),
      "Grön",
    );
  });
});
