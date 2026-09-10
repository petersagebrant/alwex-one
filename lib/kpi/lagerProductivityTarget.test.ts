import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { computeKpiStatus } from "./computeStatus";
import {
  effectiveTargetStatusTone,
  isDailyManualReportableKpi,
  STATISTIC_STATUS,
} from "./kind";
import {
  dailyKpiValidationKpiFromKpi,
  prepareDailyKpiReport,
} from "./dailyKpiReport";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260910170000_lager_kolli_consolidation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Lager & Logistik Kolli consolidation", () => {
  it("scopes to lager-logistik by slug and fails if the area is missing", () => {
    assert.match(migration, /where ba\.slug = 'lager-logistik'/);
    assert.match(migration, /Lager & Logistik business area not found/);
    assert.doesNotMatch(
      migration,
      /slug = '(kyl-frys|fjarr-miljo|mark-anlaggning|intermodal|recycling|frotradet|alwex-totalt)'/,
    );
    assert.doesNotMatch(migration, /Ordinarie arbetstid|Beläggningsgrad|Övertid/);
  });

  it("soft-archives the four replaced KPIs without deleting or copying history", () => {
    assert.match(migration, /'Kolli Byggmax'/);
    assert.match(migration, /'Kolli OOH'/);
    assert.match(migration, /'Arbetade timmar'/);
    assert.match(migration, /'Kolli per arbetad timme'/);
    assert.match(migration, /archived_at = coalesce\(archived_at, now\(\)\)/);
    assert.match(migration, /and archived_at is null/);
    assert.match(
      migration,
      /disable trigger kpis_prevent_unauthorized_archive/,
    );
    assert.match(
      migration,
      /enable trigger kpis_prevent_unauthorized_archive/,
    );
    assert.doesNotMatch(migration, /delete\s+from\s+public\.(kpis|kpi_history)/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
    assert.doesNotMatch(migration, /insert into public\.kpi_history/i);
    assert.doesNotMatch(migration, /update\s+public\.kpi_history/i);
    assert.doesNotMatch(migration, /set\s+archived_at\s*=\s*null/i);
  });

  it("inserts one empty STATISTIC Kolli without summing old values", () => {
    assert.match(migration, /k\.name = 'Kolli'/);
    assert.match(
      migration,
      /'Kolli',[\s\S]*?'Volym',[\s\S]*?'kolli',[\s\S]*?'STATISTIC'[\s\S]*?'DAILY'/,
    );
    assert.match(
      migration,
      /Unique active name is \(business_area_id, name\) WHERE archived_at IS NULL/,
    );
    assert.doesNotMatch(migration, /insert into public\.kpi_history/i);
    assert.doesNotMatch(migration, /\bsum\s*\(/i);
    assert.doesNotMatch(migration, /current_value = [^n]/);
    assert.doesNotMatch(
      migration,
      /'Kolli'[\s\S]*?target_value = '[^']+'/,
    );
    assert.doesNotMatch(migration, /yellow_tolerance,\s*[0-9]/);
    assert.doesNotMatch(migration, /green_tolerance,\s*[0-9]/);
  });

  it("is daily-reportable as STATISTIC with no G/Y/R", () => {
    const kolli = dailyKpiValidationKpiFromKpi({
      id: "lager-kolli",
      name: "Kolli",
      businessAreaId: "lager-logistik",
      kind: "STATISTIC",
      calcOperator: null,
      reportingFrequency: "DAILY",
      targetValue: null,
    });

    assert.equal(
      isDailyManualReportableKpi({
        kind: "STATISTIC",
        calcOperator: null,
        reportingFrequency: "DAILY",
      }),
      true,
    );
    assert.equal(
      computeKpiStatus({
        direction: null,
        toleranceType: null,
        yellowTolerance: null,
        value: "1200",
        target: null,
      }),
      null,
    );
    assert.equal(
      effectiveTargetStatusTone({
        kind: "STATISTIC",
        status: STATISTIC_STATUS,
        currentValue: "1200",
      }),
      null,
    );

    const saved = prepareDailyKpiReport(kolli, {
      value: "1200",
      status: STATISTIC_STATUS,
      comment: "",
      reportDate: "2026-09-10",
    });
    assert.equal(saved.ok, true);
    if (saved.ok) {
      assert.equal(saved.value.status, STATISTIC_STATUS);
      assert.equal(saved.value.value, "1200");
    }
  });
});
