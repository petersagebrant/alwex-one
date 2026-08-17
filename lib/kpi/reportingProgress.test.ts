import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countKpiSetReportingProgress } from "./reportingProgress";

describe("countKpiSetReportingProgress", () => {
  const sjuktimmar = {
    id: "num",
    kind: "STATISTIC" as const,
    calcOperator: null,
    calcNumeratorKpiId: null,
    calcDenominatorKpiId: null,
  };
  const ordinarie = {
    id: "den",
    kind: "STATISTIC" as const,
    calcOperator: null,
    calcDenominatorKpiId: null,
    calcNumeratorKpiId: null,
  };
  const sjukfranvaro = {
    id: "pct",
    kind: "TARGET" as const,
    calcOperator: "RATIO_PERCENT" as const,
    calcNumeratorKpiId: "num",
    calcDenominatorKpiId: "den",
  };
  const manualTarget = {
    id: "manual",
    kind: "TARGET" as const,
    calcOperator: null,
    calcNumeratorKpiId: null,
    calcDenominatorKpiId: null,
  };

  it("counts ratio group as one point when both inputs reported", () => {
    const kpis = [sjuktimmar, ordinarie, sjukfranvaro, manualTarget];
    const both = countKpiSetReportingProgress(
      kpis,
      new Set(["num", "den", "manual"]),
    );
    assert.deepEqual(both, { reportedCount: 2, totalCount: 2 });

    const partial = countKpiSetReportingProgress(kpis, new Set(["num"]));
    assert.deepEqual(partial, { reportedCount: 0, totalCount: 2 });
  });

  it("ignores CALCULATED rows as progress points", () => {
    const calculated = {
      id: "calc",
      kind: "CALCULATED" as const,
      calcOperator: "DIVIDE" as const,
      calcNumeratorKpiId: "num",
      calcDenominatorKpiId: "den",
    };
    const result = countKpiSetReportingProgress(
      [manualTarget, calculated],
      new Set(["manual", "calc"]),
    );
    assert.deepEqual(result, { reportedCount: 1, totalCount: 1 });
  });
});
