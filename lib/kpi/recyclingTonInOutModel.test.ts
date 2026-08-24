import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const TON_IN_DAILY_ID = "51a8c0c9-7413-4dd6-9e12-b9a88cb54617";
const TON_IN_MTD_ID = "3d58a76d-7223-42f7-abb4-ad971e15a469";
const TON_OUT_DAILY_ID = "eef11132-7c3a-46f9-9e16-c7b759dbc461";
const TON_OUT_MTD_ID = "50dc56f6-39f7-46b3-b2ea-0fb09014349f";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260824110000_recycling_ton_in_out_volume.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Recycling ton in/out volume model", () => {
  it("scopes to recycling and keeps the inbound pair UUIDs", () => {
    assert.match(migration, /where ba\.slug = 'recycling'/);
    assert.match(migration, new RegExp(TON_IN_DAILY_ID));
    assert.match(migration, new RegExp(TON_IN_MTD_ID));
    assert.match(migration, /name = 'Ton in idag'/);
    assert.match(migration, /name = 'Ton in månad hittills'/);
  });

  it("creates outbound daily and MTD rows with new UUIDs", () => {
    assert.match(migration, new RegExp(TON_OUT_DAILY_ID));
    assert.match(migration, new RegExp(TON_OUT_MTD_ID));
    assert.match(
      migration,
      /'Ton ut idag', 'Volym', null, null, 'ton',[\s\S]*?'STATISTIC'/,
    );
    assert.match(
      migration,
      /'Ton ut månad hittills', 'Volym', null, null, 'ton',[\s\S]*?'CALCULATED'/,
    );
  });

  it("wires both month-to-date sums without rewriting MTD infrastructure", () => {
    assert.equal((migration.match(/MONTH_TO_DATE_SUM/g) ?? []).length, 2);
    assert.match(
      migration,
      /calc_operator = 'MONTH_TO_DATE_SUM'[\s\S]*?calc_numerator_kpi_id = v_ton_in_daily_id/,
    );
    assert.match(
      migration,
      /'MONTH_TO_DATE_SUM', v_ton_out_daily_id, null, 'DAILY'/,
    );
    assert.doesNotMatch(
      migration,
      /create or replace function public\.recalculate_month_to_date_kpis/i,
    );
    assert.doesNotMatch(
      migration,
      /create or replace function public\.trigger_recalculate_month_to_date_kpis/i,
    );
    assert.doesNotMatch(migration, /upsert_daily_kpi_report/);
    assert.doesNotMatch(migration, /kpis_calc_fields_consistency/);
  });

  it("does not delete, archive, backfill, or touch other KPI families", () => {
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
    assert.doesNotMatch(migration, /set\s+archived_at/i);
    assert.doesNotMatch(migration, /kpi_history/);
    assert.doesNotMatch(
      migration,
      /disable trigger kpis_prevent_unauthorized_archive/,
    );
    assert.doesNotMatch(
      migration,
      /'(Omsättning idag|Omsättning månad hittills|Resultat mot budget|Ordinarie arbetstid|Sjuktimmar|Sjukfrånvaro|Volymutveckling)'/,
    );
    assert.doesNotMatch(
      migration,
      /slug = '(kyl-frys|lager-logistik|fjarr-miljo|mark-anlaggning|intermodal|frotradet|alwex-totalt)'/,
    );
  });
});
