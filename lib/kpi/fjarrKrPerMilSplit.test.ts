import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260910180000_fjarr_kr_per_mil_manual_split.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Fjärr & Miljö Kr per mil manual split", () => {
  it("scopes to fjarr-miljo by slug and fails if the area is missing", () => {
    assert.match(migration, /where ba\.slug = 'fjarr-miljo'/);
    assert.match(migration, /Fjärr & Miljö business area not found/);
    assert.doesNotMatch(
      migration,
      /slug = '(kyl-frys|lager-logistik|mark-anlaggning|intermodal|recycling|frotradet|alwex-totalt)'/,
    );
  });

  it("soft-archives only Körda mil without deleting or copying history", () => {
    assert.match(migration, /and name = 'Körda mil'/);
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
    assert.doesNotMatch(migration, /and name = 'Övertid'/);
    assert.doesNotMatch(migration, /and name = 'Sjuktimmar'/);
    assert.doesNotMatch(migration, /delete\s+from\s+public\.(kpis|kpi_history)/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
    assert.doesNotMatch(migration, /insert into public\.kpi_history/i);
    assert.doesNotMatch(migration, /update\s+public\.kpi_history/i);
  });

  it("inserts two empty STATISTIC Kr per mil splits with en-dash names", () => {
    assert.match(migration, /'Kr per mil – Elit'/);
    assert.match(migration, /'Kr per mil – Fjärr'/);
    assert.match(migration, /'kr\/mil'/);
    assert.match(migration, /'Ekonomi'/);
    assert.match(migration, /'STATISTIC'/);
    assert.match(migration, /'DAILY'/);
    assert.match(
      migration,
      /Unique active name is \(business_area_id, name\) WHERE archived_at IS NULL/,
    );
    assert.doesNotMatch(migration, /insert into public\.kpi_history/i);
    assert.doesNotMatch(migration, /yellow_tolerance,\s*[0-9]/);
    assert.doesNotMatch(migration, /green_tolerance,\s*[0-9]/);
  });

  it("does not reactivate, rename, or copy history onto archived Kr per mil", () => {
    assert.doesNotMatch(migration, /set\s+archived_at\s*=\s*null/i);
    assert.doesNotMatch(migration, /and name = 'Kr per mil'/);
    assert.doesNotMatch(migration, /set\s+name\s*=/i);
    assert.doesNotMatch(migration, /insert into public\.kpi_history/i);
    assert.doesNotMatch(migration, /update\s+public\.kpi_history/i);
    assert.match(
      migration,
      /Do not unarchive or rename the archived CALCULATED Kr per mil row/,
    );
  });
});
