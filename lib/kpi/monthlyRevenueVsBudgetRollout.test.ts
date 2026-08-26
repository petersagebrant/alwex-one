import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

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
    "../../supabase/migrations/20260826100000_monthly_revenue_vs_budget.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("monthly revenue vs budget rollout", () => {
  it("covers the 7 operational areas and excludes Alwex totalt", () => {
    assert.equal(OPERATIONAL_AREAS.length, 7);
    assert.match(migration, /from public\.business_areas ba/);
    assert.match(migration, /ba\.slug <> 'alwex-totalt'/);
    assert.match(migration, /lower\(btrim\(ba\.name\)\) <> 'alwex totalt'/);
  });

  it("soft-archives both daily revenue names per AO without deleting history", () => {
    assert.match(
      migration,
      /name in \('Omsättning idag', 'Omsättning månad hittills'\)/,
    );
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
  });

  it("inserts 7 active MONTHLY TARGET Omsättning mot budget without un-archiving", () => {
    assert.match(migration, /'Omsättning mot budget'/);
    assert.match(migration, /coalesce\(v_result\.kpi_kind, 'TARGET'\)/);
    assert.match(
      migration,
      /coalesce\(v_result\.reporting_frequency, 'MONTHLY'\)/,
    );
    assert.match(migration, /coalesce\(v_result\.unit, 'Mkr'\)/);
    assert.match(
      migration,
      /coalesce\(v_result\.direction, 'HIGHER_IS_BETTER'\)/,
    );
    assert.match(
      migration,
      /coalesce\(v_result\.tolerance_type, 'ABSOLUTE'\)/,
    );
    assert.match(
      migration,
      /coalesce\(v_result\.yellow_tolerance, 0\.2\)/,
    );
    assert.match(migration, /'Gul'/);
    assert.match(migration, /null,\s+coalesce\(v_result\.unit, 'Mkr'\)/);
    assert.match(migration, /and k\.archived_at is null/);
    assert.doesNotMatch(migration, /set\s+archived_at\s*=\s*null/i);
  });

  it("soft-archives Fjärr Kr per mil that divides archived daily revenue", () => {
    assert.match(migration, /k\.name = 'Kr per mil'/);
    assert.match(migration, /k\.calc_operator = 'DIVIDE'/);
    assert.match(migration, /n\.name = 'Omsättning idag'/);
  });

  it("leaves Snugge, övertid and sjuk KPIs untouched", () => {
    assert.doesNotMatch(migration, /Snugge/i);
    assert.doesNotMatch(migration, /Övertid|Overtid/i);
    assert.doesNotMatch(migration, /Sjukfrånvaro|Sjuktimmar|sjuk/i);
  });
});
