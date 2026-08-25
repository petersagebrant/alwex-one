import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260825100000_daily_report_backdate_snapshot.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const previousDaily = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260818200000_restore_daily_kpi_report_uniqueness.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const mtd = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260818270000_reconcile_mark_mtd_and_kpi_constraints.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("daily report backdate migration", () => {
  it("replaces upsert_daily_kpi_report and write_computed_kpi_value", () => {
    assert.match(
      migration,
      /create or replace function public\.upsert_daily_kpi_report/,
    );
    assert.match(
      migration,
      /create or replace function public\.write_computed_kpi_value/,
    );
  });

  it("does not rewrite existing history rows or the unique constraint", () => {
    assert.doesNotMatch(migration, /update\s+public\.kpi_history/i);
    assert.doesNotMatch(migration, /alter table public\.kpi_history/i);
    assert.doesNotMatch(
      migration,
      /unique \(kpi_id, report_date\)/,
    );
    assert.match(
      previousDaily,
      /unique \(kpi_id, report_date\)/,
    );
  });

  it("keeps unique = update and accepts literal 0", () => {
    assert.match(migration, /on conflict \(kpi_id, report_date\)/);
    assert.match(migration, /do update set/);
    assert.match(migration, /v_value := btrim\(coalesce\(p_value, ''\)\);/);
    assert.match(migration, /if v_value = '' then/);
    assert.doesNotMatch(migration, /if v_value = '0'/);
  });

  it("does not fabricate a previous-day reported value", () => {
    assert.doesNotMatch(migration, /Bevarat före dagsrapport/);
    assert.doesNotMatch(migration, /p_report_date - 1/);
    assert.doesNotMatch(migration, /v_prior_date/);
  });

  it("sets recorded_at to now and rejects future Stockholm dates", () => {
    assert.match(migration, /recorded_at,\s*\n\s*report_date,/);
    assert.match(migration, /now\(\),\s*\n\s*p_report_date,/);
    assert.match(migration, /recorded_at = now\(\)/);
    assert.match(
      migration,
      /v_today := \(timezone\('Europe\/Stockholm', now\(\)\)\)::date/,
    );
    assert.match(migration, /if p_report_date > v_today then/);
    assert.doesNotMatch(
      migration,
      /p_report_date::timestamp \+ time '12:00'/,
    );
  });

  it("updates current_value only when report_date is the latest active day", () => {
    const upsert = migration.match(
      /create or replace function public\.upsert_daily_kpi_report[\s\S]*?comment on function public\.upsert_daily_kpi_report/,
    )?.[0];
    const computed = migration.match(
      /create or replace function public\.write_computed_kpi_value[\s\S]*?comment on function public\.write_computed_kpi_value/,
    )?.[0];
    assert.ok(upsert);
    assert.ok(computed);
    const guard =
      /select max\(h\.report_date\)[\s\S]*h\.archived_at is null[\s\S]*if v_max_report_date is null or p_report_date >= v_max_report_date then/;
    assert.match(upsert, guard);
    assert.match(computed, guard);
    assert.match(upsert, /update public\.kpis/);
    assert.match(computed, /update public\.kpis/);
  });

  it("does not rewrite MTD SUM; MTD still keys off report_date", () => {
    assert.doesNotMatch(
      migration,
      /create or replace function public\.recalculate_month_to_date_kpis/i,
    );
    assert.match(
      mtd,
      /h\.report_date >= date_trunc\('month', v_date\)::date/,
    );
    assert.match(mtd, /h\.report_date <= v_date/);
  });

  it("counts a backdated day in the same month for MTD SUM", () => {
    const rows = [
      { reportDate: "2026-07-31", value: 9 },
      { reportDate: "2026-08-10", value: 2 },
      { reportDate: "2026-08-20", value: 3 },
    ];
    const monthStart = "2026-08-01";
    const asOf = "2026-08-24";
    const sum = rows
      .filter(
        (row) => row.reportDate >= monthStart && row.reportDate <= asOf,
      )
      .reduce((acc, row) => acc + row.value, 0);
    assert.equal(sum, 5);
  });

  it("does not change operational write permissions", () => {
    assert.doesNotMatch(migration, /can_write_operational/);
    assert.doesNotMatch(migration, /create policy/i);
    assert.doesNotMatch(migration, /alter policy/i);
  });
});
