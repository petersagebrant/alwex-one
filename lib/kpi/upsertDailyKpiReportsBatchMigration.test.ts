import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260825150000_upsert_daily_kpi_reports_batch.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("upsert_daily_kpi_reports batch migration", () => {
  it("loops existing upsert_daily_kpi_report and does not delete history", () => {
    assert.match(
      migration,
      /create or replace function public\.upsert_daily_kpi_reports/,
    );
    assert.match(migration, /language plpgsql/);
    assert.match(migration, /security invoker/);
    assert.match(
      migration,
      /for v_item in\s+select value\s+from jsonb_array_elements\(p_reports\)/,
    );
    assert.match(
      migration,
      /perform public\.upsert_daily_kpi_report\(/,
    );
    assert.match(
      migration,
      /grant execute on function public\.upsert_daily_kpi_reports\(jsonb, uuid\)/,
    );
    assert.doesNotMatch(migration, /delete\s+from\s+public\.kpi_history/i);
    assert.doesNotMatch(migration, /insert\s+into\s+public\.kpi_history/i);
    assert.doesNotMatch(migration, /update\s+public\.kpis/i);
  });
});
