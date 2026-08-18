import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { computeKpiStatus } from "./computeStatus";
import { isManualReportableKpi, isSystemComputedKpi } from "./kind";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260818240000_mark_month_to_date_sick_leave.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Mark & Anläggning month-to-date sick leave", () => {
  it("configures only Mark's Sjukfrånvaro as a system-computed TARGET", () => {
    assert.match(migration, /where ba\.slug = 'mark-anlaggning'/);
    assert.match(migration, /k\.name = 'Sjukfrånvaro'/);
    assert.match(
      migration,
      /set calc_operator = 'MONTH_TO_DATE_RATIO_PERCENT'/,
    );
    assert.match(migration, /k\.kpi_kind = 'TARGET'/);
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
    assert.equal((migration.match(/update public\.kpis/g) ?? []).length, 1);

    const kpi = {
      kind: "TARGET" as const,
      calcOperator: "MONTH_TO_DATE_RATIO_PERCENT" as const,
    };
    assert.equal(isSystemComputedKpi(kpi), true);
    assert.equal(isManualReportableKpi(kpi), false);
  });

  it("uses active calendar-month sums on both sides and recalculates later dates", () => {
    assert.match(
      migration,
      /v_result := \(v_sum_num \/ v_sum_den\) \* 100/,
    );
    assert.match(
      migration,
      /h\.report_date >= date_trunc\('month', v_date\)::date[\s\S]*?h\.report_date <= v_date[\s\S]*?h\.archived_at is null/,
    );
    assert.match(
      migration,
      /c\.calc_numerator_kpi_id = p_input_kpi_id[\s\S]*?c\.calc_denominator_kpi_id = p_input_kpi_id/,
    );
    assert.match(
      migration,
      /h\.report_date >= p_changed_date[\s\S]*?date_trunc\('month', p_changed_date\) \+ interval '1 month'/,
    );
    assert.match(
      migration,
      /date_trunc\('month', v_stockholm_today\)[\s\S]*?interval '1 month'/,
    );
  });

  it("keeps the agreed green, yellow, and red boundaries", () => {
    const status = (value: number) =>
      computeKpiStatus({
        direction: "LOWER_IS_BETTER",
        toleranceType: "ABSOLUTE",
        yellowTolerance: 1,
        value,
        target: 3,
      });

    assert.equal(status(3), "Grön");
    assert.equal(status(3.001), "Gul");
    assert.equal(status(4), "Gul");
    assert.equal(status(4.001), "Röd");
    assert.match(migration, /target_value = '3'/);
    assert.match(migration, /yellow_tolerance = 1/);
  });
});
