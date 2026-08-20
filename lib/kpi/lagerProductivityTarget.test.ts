import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { computeSumDivideValue } from "./calculated";
import { computeKpiStatus } from "./computeStatus";
import { isManualReportableKpi, isSystemComputedKpi } from "./kind";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260818250000_lager_productivity_target.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Lager & Logistik productivity target", () => {
  it("keeps the existing formula and makes only Lager productivity a TARGET", () => {
    assert.match(migration, /where ba\.slug = 'lager-logistik'/);
    assert.match(migration, /k\.name = 'Kolli per arbetad timme'/);
    assert.match(migration, /set kpi_kind = 'TARGET'/);
    assert.match(migration, /target_value = '100'/);
    assert.equal((migration.match(/update public\.kpis/g) ?? []).length, 1);

    assert.equal(computeSumDivideValue(["8000", "2000"], "500"), "20");
  });

  it("keeps all three source KPIs as active manual statistics", () => {
    assert.match(
      migration,
      /v_source_names is distinct from array\['Kolli OOH', 'Kolli Byggmax'\]::text\[\]/,
    );
    assert.match(
      migration,
      /k\.name = 'Arbetade timmar'[\s\S]*?k\.kpi_kind = 'STATISTIC'/,
    );
    assert.doesNotMatch(
      migration,
      /set[\s\S]{0,100}kpi_kind = 'STATISTIC'/,
    );
  });

  it("is read-only and uses the agreed green, yellow, and red thresholds", () => {
    const productivity = {
      kind: "TARGET" as const,
      calcOperator: "SUM_DIVIDE" as const,
    };
    assert.equal(isSystemComputedKpi(productivity), true);
    assert.equal(isManualReportableKpi(productivity), false);

    const status = (value: number) =>
      computeKpiStatus({
        direction: "HIGHER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        yellowTolerance: 10,
        value,
        target: 100,
      });

    assert.equal(status(100), "Grön");
    assert.equal(status(99.999), "Gul");
    assert.equal(status(90), "Gul");
    assert.equal(status(89.999), "Röd");
  });

  it("recalculates from active same-day rows and clears incomplete results", () => {
    assert.match(
      migration,
      /h\.report_date = p_report_date[\s\S]*?h\.archived_at is null/,
    );
    assert.match(
      migration,
      /v_result := v_sum_num \/ v_den/,
    );
    assert.match(
      migration,
      /after insert or update of value, report_date, archived_at/,
    );
    assert.match(
      migration,
      /'—',[\s\S]*?'Gul',[\s\S]*?'Beräknad – saknar komplett underlag'/,
    );
  });

  it("does not backfill or modify existing KPI history during deployment", () => {
    const deploymentBlock = migration.slice(migration.lastIndexOf("do $$"));

    assert.doesNotMatch(deploymentBlock, /kpi_history/);
    assert.doesNotMatch(
      deploymentBlock,
      /perform public\.recalculate_target_sum_divide_kpis/,
    );
    assert.doesNotMatch(migration, /update\s+public\.kpi_history/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\.kpi_history/i);
    assert.match(
      deploymentBlock,
      /current_value = case[\s\S]*?when kpi_kind = 'TARGET' then current_value[\s\S]*?else null/,
    );
    assert.match(
      deploymentBlock,
      /kpi_kind is distinct from 'TARGET'[\s\S]*?reporting_frequency is distinct from 'DAILY'/,
    );
    assert.match(
      migration,
      /calc_effective_from = coalesce\([\s\S]*?Europe\/Stockholm/,
    );
    assert.match(
      migration,
      /p_report_date >= c\.calc_effective_from/,
    );
  });
});
