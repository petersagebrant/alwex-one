import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  hasValidKpiCurrentValue,
  isDailyManualReportableKpi,
  isSystemComputedKpi,
} from "./kind";
import { parseNumeric } from "./parseNumeric";

const AREAS = [
  {
    slug: "kyl-frys",
    areaId: "cd3371ca-1bc5-4dbc-b968-3562fb9baac6",
    dailyId: "0605b3b1-d6df-4984-b3d8-952b6dcb238e",
    mtdId: "b1fb2354-0f2d-4626-b28e-52ef3a96070d",
  },
  {
    slug: "lager-logistik",
    areaId: "d6fddf98-ef3d-4f35-9a16-bbc1b7d384c6",
    dailyId: "c7b603dc-5cc3-44d5-980e-0bd5838be3da",
    mtdId: "065dfa43-b54a-49f5-a019-11082bb8a598",
  },
  {
    slug: "fjarr-miljo",
    areaId: "a30b9d4d-d9d7-4975-b7da-413c907e5c3a",
    dailyId: "93488efe-7540-40db-9153-b47f61611790",
    mtdId: "5920bd91-aec5-4f12-b685-7889e155f086",
  },
  {
    slug: "mark-anlaggning",
    areaId: "550a4dc4-97a6-48fb-99b8-ef2e4c16b5a7",
    dailyId: "15197658-5dbc-4331-bad0-edf23c7a153e",
    mtdId: "814ad54c-0b5c-4939-bfdd-be8be8908144",
  },
  {
    slug: "recycling",
    areaId: "281ef37b-1195-4f40-ab9c-55757090e858",
    dailyId: "8088ace8-01cd-48c7-9e02-bbfdd480a4b0",
    mtdId: "ca9c6af9-f22f-406a-a92d-182d3688c3e2",
  },
  {
    slug: "intermodal",
    areaId: "21b2decb-51e6-4110-99b6-e2e5a6c0977e",
    dailyId: "c63f4f63-0fb5-4511-9b4d-d1eef26659c1",
    mtdId: "d7c6f52e-aa4b-4b3a-9a13-2b7c9901f90c",
  },
  {
    slug: "frotradet",
    areaId: "da129776-7230-41d5-871b-4d87820aa4d3",
    dailyId: "faa991aa-d60d-4d53-a167-8b67c9d71fdb",
    mtdId: "ebc03f93-188f-4ce5-b9d7-3ef2c6bd08a9",
  },
] as const;

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260825110000_overtid_hours_kpis.sql",
    import.meta.url,
  ),
  "utf8",
);

const mtd = readFileSync(
  new URL(
    "../../supabase/migrations/20260818270000_reconcile_mark_mtd_and_kpi_constraints.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Övertid hours model for every operational area", () => {
  it("covers all seven operational areas and excludes Alwex totalt", () => {
    assert.equal(AREAS.length, 7);
    for (const area of AREAS) {
      assert.match(migration, new RegExp(`'${area.slug}'`));
      assert.match(migration, new RegExp(area.areaId));
      assert.match(migration, new RegExp(area.dailyId));
      assert.match(migration, new RegExp(area.mtdId));
    }
    assert.match(migration, /from public\.business_areas ba/);
    assert.match(migration, /ba\.slug <> 'alwex-totalt'/);
    assert.match(migration, /lower\(btrim\(ba\.name\)\) <> 'alwex totalt'/);
    assert.doesNotMatch(migration, /WEIGHTED_RATIO_PERCENT/);
    assert.doesNotMatch(migration, /'Övertid \(timmar\)'/);
  });

  it("creates two KPIs per area: STATISTIC daily hours and CALCULATED MTD", () => {
    assert.match(
      migration,
      /'Övertid', 'Personal', null, null, 'h',[\s\S]*?'STATISTIC'[\s\S]*?'DAILY'/,
    );
    assert.match(
      migration,
      /'Övertid månad hittills', 'Personal',[\s\S]*?'h',[\s\S]*?'CALCULATED'[\s\S]*?'MONTH_TO_DATE_SUM', v_daily_id, null, 'DAILY'/,
    );
    assert.equal((migration.match(/'Övertid'/g) ?? []).length, 2);
    assert.equal((migration.match(/'Övertid månad hittills'/g) ?? []).length, 2);
  });

  it("wires MONTH_TO_DATE_SUM to that area's Övertid without rewriting MTD", () => {
    assert.equal((migration.match(/MONTH_TO_DATE_SUM/g) ?? []).length, 1);
    assert.match(
      migration,
      /'MONTH_TO_DATE_SUM', v_daily_id, null, 'DAILY'/,
    );
    assert.match(migration, /k\.name = 'Övertid'/);
    assert.match(migration, /k\.name = 'Övertid månad hittills'/);
    assert.doesNotMatch(
      migration,
      /create or replace function public\.recalculate_month_to_date_kpis/i,
    );
    assert.doesNotMatch(migration, /perform public\.recalculate_month_to_date_kpis/);
    assert.match(
      mtd,
      /h\.report_date >= date_trunc\('month', v_date\)::date/,
    );
    assert.match(mtd, /h\.report_date <= v_date/);
  });

  it("inserts only and does not delete existing KPIs or history", () => {
    assert.match(migration, /insert into public\.kpis/);
    assert.doesNotMatch(migration, /update\s+public\.kpis/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\.(kpis|kpi_history)/i);
    assert.doesNotMatch(migration, /kpi_history/);
    assert.doesNotMatch(migration, /set\s+archived_at/i);
  });

  it("treats 0 hours as valid and counts a backdated 0 in the same month", () => {
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

    const rows = [
      { reportDate: "2026-07-31", value: 9 },
      { reportDate: "2026-08-10", value: 0 },
      { reportDate: "2026-08-20", value: 3 },
    ];
    const monthStart = "2026-08-01";
    const asOf = "2026-08-24";
    const sum = rows
      .filter(
        (row) => row.reportDate >= monthStart && row.reportDate <= asOf,
      )
      .reduce((acc, row) => acc + row.value, 0);
    assert.equal(sum, 3);
  });
});
