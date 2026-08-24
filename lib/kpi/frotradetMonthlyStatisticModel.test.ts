import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const LEVERANS_ID = "880f6f17-305a-4c05-bbbd-e45756f4317d";
const ENERGY_ID = "b77f2264-d2db-4ed0-a6f0-34c514b24e99";
const OFFICES_ID = "97823e81-7a87-4dfc-b664-16d14d90dd79";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260824140000_frotradet_monthly_statistic_kpis.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Fröträdet monthly STATISTIC KPI model", () => {
  it("scopes to frotradet and fails if the area is missing", () => {
    assert.match(migration, /where ba\.slug = 'frotradet'/);
    assert.match(migration, /Fröträdet business area not found/);
    assert.doesNotMatch(
      migration,
      /slug = '(kyl-frys|lager-logistik|fjarr-miljo|mark-anlaggning|intermodal|recycling|alwex-totalt)'/,
    );
  });

  it("archives Leveransförmåga by UUID and name without deleting", () => {
    assert.match(migration, new RegExp(LEVERANS_ID));
    assert.match(migration, /name = 'Leveransförmåga'/);
    assert.match(migration, /archived_at = coalesce\(archived_at, now\(\)\)/);
    assert.match(
      migration,
      /disable trigger kpis_prevent_unauthorized_archive/,
    );
    assert.match(
      migration,
      /enable trigger kpis_prevent_unauthorized_archive/,
    );
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
  });

  it("creates two STATISTIC MONTHLY KPIs with units and no targets", () => {
    assert.match(migration, new RegExp(ENERGY_ID));
    assert.match(migration, new RegExp(OFFICES_ID));
    assert.match(
      migration,
      /'Energiförbrukning per månad', 'Energi',[\s\S]*?'kWh',[\s\S]*?'STATISTIC'[\s\S]*?'MONTHLY'/,
    );
    assert.match(
      migration,
      /'Antal uthyrda kontor per månad', 'Fastighet',[\s\S]*?'st',[\s\S]*?'STATISTIC'[\s\S]*?'MONTHLY'/,
    );
    assert.match(migration, /status = 'Statistik'/);
  });

  it("adds monthly STATISTIC RPC without rewriting economic or MTD paths", () => {
    assert.match(
      migration,
      /create or replace function public\.upsert_monthly_statistic_report/,
    );
    assert.match(migration, /Only active monthly STATISTIC KPIs/);
    assert.match(migration, /format_kpi_numeric_sv/);
    assert.match(migration, /actual_value, budget_value[\s\S]*?null, null, 'Statistik'/);
    assert.doesNotMatch(
      migration,
      /create or replace function public\.upsert_monthly_kpi_report/,
    );
    assert.doesNotMatch(
      migration,
      /create or replace function public\.recalculate_month_to_date_kpis/i,
    );
    assert.doesNotMatch(
      migration,
      /create or replace function public\.upsert_daily_kpi_report/i,
    );
    assert.doesNotMatch(migration, /kpis_calc_fields_consistency/);
  });
});
