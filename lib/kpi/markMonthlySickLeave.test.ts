import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { computeKpiStatus } from "./computeStatus";
import { isManualReportableKpi, isSystemComputedKpi } from "./kind";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260818270000_reconcile_mark_mtd_and_kpi_constraints.sql",
    import.meta.url,
  ),
  "utf8",
);
const migrationNames = readdirSync(
  new URL("../../supabase/migrations", import.meta.url),
);

describe("Mark & Anläggning month-to-date sick leave", () => {
  it("retires the unapplied 24000 migration in favor of the reconciliation", () => {
    assert.equal(
      migrationNames.includes(
        "20260818240000_mark_month_to_date_sick_leave.sql",
      ),
      false,
    );
    assert.equal(
      migrationNames.includes(
        "20260818270000_reconcile_mark_mtd_and_kpi_constraints.sql",
      ),
      true,
    );
    assert.match(migration, /^-- Forward-only reconciliation/m);
    assert.match(migration, /\bbegin;[\s\S]*\bcommit;/);
  });

  it("configures only Mark's Sjukfrånvaro as a system-computed TARGET", () => {
    assert.match(migration, /where ba\.slug = 'mark-anlaggning'/);
    assert.match(migration, /k\.name = 'Sjukfrånvaro'/);
    assert.match(migration, /k\.name = 'Sjuktimmar'/);
    assert.match(migration, /k\.name = 'Ordinarie arbetstid'/);
    assert.match(
      migration,
      /set calc_operator = 'MONTH_TO_DATE_RATIO_PERCENT'/,
    );
    assert.match(migration, /k\.kpi_kind = 'TARGET'/);
    assert.doesNotMatch(migration, /delete\s+from\s+public\./i);
    assert.doesNotMatch(migration, /set[\s\S]{0,120}archived_at\s*=/i);
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

  it("preserves the latest combined KPI constraint semantics", () => {
    assert.match(
      migration,
      /calc_operator = 'SUM_DIVIDE'[\s\S]*?calc_effective_from is not null/,
    );
    assert.match(
      migration,
      /calc_operator = 'WEIGHTED_RATIO_PERCENT'[\s\S]*?direction is not null[\s\S]*?target_value is not null/,
    );
    assert.match(
      migration,
      /calc_operator in \([\s\S]*?'RATIO_PERCENT',[\s\S]*?'MONTH_TO_DATE_RATIO_PERCENT'[\s\S]*?\)/,
    );
    assert.match(
      migration,
      /Computed TARGET: RATIO_PERCENT, MONTH_TO_DATE_RATIO_PERCENT, SUM_DIVIDE, WEIGHTED_RATIO_PERCENT/,
    );
  });

  it("does not backfill or mutate KPI history during deployment", () => {
    const deploymentBlock = migration.slice(migration.lastIndexOf("do $$"));

    assert.doesNotMatch(deploymentBlock, /public\.kpi_history/);
    assert.doesNotMatch(
      deploymentBlock,
      /perform public\.recalculate_month_to_date_kpis/,
    );
    assert.doesNotMatch(migration, /update\s+public\.kpi_history/i);
    assert.doesNotMatch(migration, /delete\s+from\s+public\.kpi_history/i);
    assert.match(migration, /Deliberately no deployment-time backfill/);
  });

  it("does not touch RLS or unrelated operational domains", () => {
    assert.doesNotMatch(migration, /\b(?:create|alter|drop)\s+policy\b/i);
    assert.doesNotMatch(migration, /\brow level security\b/i);
    assert.doesNotMatch(
      migration,
      /\b(?:update|insert\s+into|delete\s+from)\s+public\.(?:profiles|kpi_history|ai_)/i,
    );
    assert.doesNotMatch(migration, /\bauth\.(?:users|identities)\b/i);
    assert.doesNotMatch(migration, /lager-logistik|Kolli per arbetad timme/);
  });
});
