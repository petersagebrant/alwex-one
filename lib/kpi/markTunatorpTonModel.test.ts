import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  hasValidKpiCurrentValue,
  isDailyManualReportableKpi,
  isSystemComputedKpi,
} from "./kind";
import { parseNumeric } from "./parseNumeric";

const TON_IN_DAILY_ID = "c84cd886-832a-46df-b395-e16cbdeca55d";
const TON_IN_MTD_ID = "6b396a9f-7636-4f28-9dc2-476a06410fce";
const TON_OUT_DAILY_ID = "eaa9a37f-f2a1-4634-ac7f-c3dbe33e3d20";
const TON_OUT_MTD_ID = "c8499840-1b0c-41a4-afd8-3ea0acf12a17";
const SNUGGE_ID = "cddfd513-ec30-46e5-a1b2-9b38bec3c7f6";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260825120000_mark_tunatorp_ton_volume.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Mark Tunatorp ton in/out volume model", () => {
  it("scopes to mark-anlaggning and fails if the area is missing", () => {
    assert.match(migration, /where ba\.slug = 'mark-anlaggning'/);
    assert.match(migration, /550a4dc4-97a6-48fb-99b8-ef2e4c16b5a7/);
    assert.match(migration, /Mark & Anläggning business area not found/);
    assert.doesNotMatch(
      migration,
      /slug = '(kyl-frys|lager-logistik|fjarr-miljo|recycling|intermodal|frotradet|alwex-totalt)'/,
    );
  });

  it("creates four named rows with new UUIDs", () => {
    assert.match(migration, new RegExp(TON_IN_DAILY_ID));
    assert.match(migration, new RegExp(TON_IN_MTD_ID));
    assert.match(migration, new RegExp(TON_OUT_DAILY_ID));
    assert.match(migration, new RegExp(TON_OUT_MTD_ID));
    assert.match(
      migration,
      /'Ton in Tunatorp', 'Volym', null, null, 'ton',[\s\S]*?'STATISTIC'/,
    );
    assert.match(
      migration,
      /'Ton in Tunatorp månad hittills', 'Volym',[\s\S]*?'ton',[\s\S]*?'CALCULATED'/,
    );
    assert.match(
      migration,
      /'Ton ut Tunatorp', 'Volym', null, null, 'ton',[\s\S]*?'STATISTIC'/,
    );
    assert.match(
      migration,
      /'Ton ut Tunatorp månad hittills', 'Volym',[\s\S]*?'ton',[\s\S]*?'CALCULATED'/,
    );
  });

  it("wires both month-to-date sums without rewriting MTD infrastructure", () => {
    assert.equal((migration.match(/MONTH_TO_DATE_SUM/g) ?? []).length, 2);
    assert.match(
      migration,
      /'MONTH_TO_DATE_SUM', v_ton_in_daily_id, null, 'DAILY'/,
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

  it("does not touch Ton ut Snugge in UPDATE or DELETE", () => {
    assert.doesNotMatch(migration, new RegExp(SNUGGE_ID));
    assert.doesNotMatch(migration, /Ton ut Snugge/);
    assert.doesNotMatch(migration, /update\s+public\.kpis/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
  });

  it("does not archive, backfill, or touch other KPI families", () => {
    assert.doesNotMatch(migration, /set\s+archived_at/i);
    assert.doesNotMatch(migration, /kpi_history/);
    assert.doesNotMatch(
      migration,
      /disable trigger kpis_prevent_unauthorized_archive/,
    );
    assert.doesNotMatch(
      migration,
      /'(Omsättning idag|Omsättning månad hittills|Resultat mot budget|Ordinarie arbetstid|Sjuktimmar|Sjukfrånvaro|Övertid|Kubik ut Betongstationen)'/,
    );
  });

  it("treats 0 tonnes as a valid daily STATISTIC value", () => {
    assert.equal(parseNumeric("0"), 0);
    assert.equal(hasValidKpiCurrentValue("0"), true);
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
        kind: "CALCULATED",
        calcOperator: "MONTH_TO_DATE_SUM",
      }),
      true,
    );
  });
});
