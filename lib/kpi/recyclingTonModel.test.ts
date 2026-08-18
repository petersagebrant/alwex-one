import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { countTargetKpiStatuses } from "./kind";
import { countKpiSetReportingProgress } from "./reportingProgress";
import { selectKeyKpis } from "./selectKeyKpis";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260818220000_recycling_ton_volume_model.sql",
    import.meta.url,
  ),
  "utf8",
);

const archivedMtdCorrection = readFileSync(
  new URL(
    "../../supabase/migrations/20260818230000_mtd_archived_history_empty_sum.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Recycling ton volume model", () => {
  it("creates one manual daily ton input and one automatic MTD sum", () => {
    assert.match(migration, /where ba\.slug = 'recycling'/);
    assert.match(
      migration,
      /'Ton idag', 'Volym', null, null, 'ton',[\s\S]*?'STATISTIC'/,
    );
    assert.match(
      migration,
      /'Ton månad hittills', 'Volym', null, null, 'ton',[\s\S]*?'CALCULATED'/,
    );
    assert.match(migration, /calc_operator = 'MONTH_TO_DATE_SUM'/);
    assert.match(migration, /calc_numerator_kpi_id = v_ton_daily_id/);
  });

  it("soft-archives the percentage KPI without changing its history or goal", () => {
    assert.match(
      migration,
      /name = 'Volymutveckling'[\s\S]*?archived_at is null/,
    );
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
    assert.doesNotMatch(migration, /update\s+public\.kpi_history/i);
    assert.doesNotMatch(migration, /public\.goals/i);
    assert.match(
      migration,
      /disable trigger kpis_prevent_unauthorized_archive/,
    );
    assert.match(
      migration,
      /enable trigger kpis_prevent_unauthorized_archive/,
    );
  });

  it("does not modify the economic or sickness KPI definitions", () => {
    assert.doesNotMatch(
      migration,
      /'(Omsättning idag|Omsättning månad hittills|Resultat mot budget|Ordinarie arbetstid|Sjuktimmar|Sjukfrånvaro)'/,
    );
  });

  it("excludes archived source history and recalculates on archive changes", () => {
    assert.match(
      migration,
      /select sum\(public\.parse_kpi_numeric_text\(h\.value\)\)[\s\S]*?and h\.archived_at is null/,
    );
    assert.match(
      migration,
      /old\.archived_at is distinct from new\.archived_at/,
    );
    assert.match(
      migration,
      /after insert or update of value, report_date, archived_at/,
    );
    assert.match(
      archivedMtdCorrection,
      /select coalesce\([\s\S]*?sum\(public\.parse_kpi_numeric_text\(h\.value\)\),[\s\S]*?0[\s\S]*?and h\.archived_at is null/,
    );
    assert.doesNotMatch(archivedMtdCorrection, /if v_sum is null/);
  });

  it("keeps daily progress stable and excludes ton statistics from G/Y/R", () => {
    const kpis = [
      {
        id: "ton-idag",
        kind: "STATISTIC" as const,
        calcOperator: null,
        reportingFrequency: "DAILY" as const,
        status: "Statistik" as const,
        currentValue: "12",
      },
      {
        id: "ton-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "ton-idag",
        reportingFrequency: "DAILY" as const,
        status: "Statistik" as const,
        currentValue: "120",
      },
      {
        id: "omsattning",
        kind: "STATISTIC" as const,
        calcOperator: null,
        reportingFrequency: "DAILY" as const,
        status: "Statistik" as const,
        currentValue: "1000",
      },
      {
        id: "sjuktimmar",
        kind: "STATISTIC" as const,
        calcOperator: null,
        reportingFrequency: "DAILY" as const,
        status: "Statistik" as const,
        currentValue: "3",
      },
      {
        id: "ordinarie",
        kind: "STATISTIC" as const,
        calcOperator: null,
        reportingFrequency: "DAILY" as const,
        status: "Statistik" as const,
        currentValue: "100",
      },
      {
        id: "sjukfranvaro",
        kind: "TARGET" as const,
        calcOperator: "RATIO_PERCENT" as const,
        calcNumeratorKpiId: "sjuktimmar",
        calcDenominatorKpiId: "ordinarie",
        ratioReportingMode: "GROUPED" as const,
        reportingFrequency: "DAILY" as const,
        status: "Grön" as const,
        currentValue: "3",
      },
      {
        id: "resultat",
        kind: "TARGET" as const,
        calcOperator: null,
        reportingFrequency: "MONTHLY" as const,
        status: "Gul" as const,
        currentValue: "-0,2",
      },
    ];
    const reported = new Set([
      "ton-idag",
      "omsattning",
      "sjuktimmar",
      "ordinarie",
    ]);

    assert.deepEqual(countKpiSetReportingProgress(kpis, reported), {
      reportedCount: 3,
      totalCount: 3,
    });
    assert.deepEqual(
      countTargetKpiStatuses(kpis.slice(0, 2)),
      { Grön: 0, Gul: 0, Röd: 0 },
    );
    assert.deepEqual(selectKeyKpis(kpis.slice(0, 2)), []);
  });
});
