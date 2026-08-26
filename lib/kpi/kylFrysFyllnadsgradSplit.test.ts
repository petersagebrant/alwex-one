import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { computeKpiStatus } from "./computeStatus";
import {
  dailyKpiValidationKpiFromKpi,
  prepareDailyKpiReport,
} from "./dailyKpiReport";
import { isDailyManualReportableKpi } from "./kind";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260827100000_kyl_frys_fyllnadsgrad_split.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Kyl & Frys Fyllnadsgrad split", () => {
  it("scopes to kyl-frys by slug and fails if the area is missing", () => {
    assert.match(migration, /where ba\.slug = 'kyl-frys'/);
    assert.match(migration, /Kyl & Frys business area not found/);
    assert.doesNotMatch(
      migration,
      /slug = '(lager-logistik|fjarr-miljo|mark-anlaggning|intermodal|recycling|frotradet|alwex-totalt)'/,
    );
    assert.doesNotMatch(migration, /Beläggningsgrad/);
  });

  it("soft-archives only active Fyllnadsgrad without deleting or copying history", () => {
    assert.match(migration, /and name = 'Fyllnadsgrad'/);
    assert.match(migration, /archived_at = coalesce\(archived_at, now\(\)\)/);
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
    assert.doesNotMatch(migration, /set\s+archived_at\s*=\s*null/i);
  });

  it("inserts two daily TARGET fill KPIs copied from Fyllnadsgrad", () => {
    assert.match(migration, /'Fyllnadsgrad mellantransporter'/);
    assert.match(migration, /'Fyllnadsgrad distributionstransporter'/);
    assert.match(migration, /coalesce\(v_src\.category, 'Effektivitet'\)/);
    assert.match(migration, /coalesce\(v_src\.target_value, '90'\)/);
    assert.match(migration, /coalesce\(v_src\.unit, '%'\)/);
    assert.match(migration, /coalesce\(v_src\.kpi_kind, 'TARGET'\)/);
    assert.match(migration, /coalesce\(v_src\.direction, 'HIGHER_IS_BETTER'\)/);
    assert.match(migration, /coalesce\(v_src\.tolerance_type, 'ABSOLUTE'\)/);
    assert.match(migration, /coalesce\(v_src\.green_tolerance, 0\)/);
    assert.match(migration, /coalesce\(v_src\.yellow_tolerance, 5\)/);
    assert.match(migration, /coalesce\(v_src\.reporting_frequency, 'DAILY'\)/);
    assert.match(migration, /'Gul'/);
    assert.match(migration, /'Oförändrad'/);
    assert.match(
      migration,
      /null,\s+coalesce\(v_src\.unit, '%'\)/,
    );
  });

  it("inserts Intjänandegrad per RPU as STATISTIC DAILY with unit kr/RPU and no fake target", () => {
    assert.match(migration, /'Intjänandegrad per RPU'/);
    assert.match(migration, /'kr\/RPU'/);
    assert.match(
      migration,
      /'Intjänandegrad per RPU',[\s\S]*?'Effektivitet',[\s\S]*?'STATISTIC'[\s\S]*?'DAILY'/,
    );
    assert.match(migration, /Convert to TARGET later/);
    assert.doesNotMatch(
      migration,
      /'Intjänandegrad per RPU'[\s\S]*?target_value = '0'/,
    );
    assert.doesNotMatch(
      migration,
      /'Intjänandegrad per RPU'[\s\S]*?target_value = '90'/,
    );
    assert.equal(
      formatKpiDisplayValue("12,5", "kr/RPU"),
      "12,5 kr/RPU",
    );
  });

  it("keeps Intjänandegrad daily-reportable as STATISTIC because TARGET-null breaks G/Y/R", () => {
    const targetWithoutMal = dailyKpiValidationKpiFromKpi({
      id: "intjanande-target",
      name: "Intjänandegrad per RPU",
      businessAreaId: "kyl-frys",
      kind: "TARGET",
      calcOperator: null,
      reportingFrequency: "DAILY",
      direction: "HIGHER_IS_BETTER",
      toleranceType: "ABSOLUTE",
      yellowTolerance: 5,
      targetValue: null,
    });
    const statisticDaily = dailyKpiValidationKpiFromKpi({
      id: "intjanande-stat",
      name: "Intjänandegrad per RPU",
      businessAreaId: "kyl-frys",
      kind: "STATISTIC",
      calcOperator: null,
      reportingFrequency: "DAILY",
      targetValue: null,
    });

    assert.equal(
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        yellowTolerance: 5,
        value: "85",
        target: null,
      }),
      null,
    );

    const targetSave = prepareDailyKpiReport(targetWithoutMal, {
      value: "85",
      status: "Gul",
      comment: "",
      reportDate: "2026-08-26",
    });
    assert.equal(targetSave.ok, false);
    if (!targetSave.ok) {
      assert.equal(targetSave.error, "Beskriv kort varför KPI:n avviker.");
    }

    const statisticSave = prepareDailyKpiReport(statisticDaily, {
      value: "85",
      status: "Statistik",
      comment: "",
      reportDate: "2026-08-26",
    });
    assert.equal(statisticSave.ok, true);
    if (statisticSave.ok) {
      assert.equal(statisticSave.value.status, "Statistik");
      assert.equal(statisticSave.value.value, "85");
    }

    assert.equal(
      isDailyManualReportableKpi({
        kind: "STATISTIC",
        calcOperator: null,
        reportingFrequency: "DAILY",
      }),
      true,
    );
    assert.equal(
      isDailyManualReportableKpi({
        kind: "TARGET",
        calcOperator: null,
        reportingFrequency: "DAILY",
      }),
      true,
    );
  });
});
