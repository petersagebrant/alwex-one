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

  it("Kyl & Frys: 6 manual points; Sjukfrånvaro=1; DIVIDE excluded", () => {
    // Standalone: Fyllnadsgrad, Leveransprecision, Resultat, Antal RC, Körda mil
    // Ratio block: Sjuktimmar + Ordinarie (+ Sjukfrånvaro result) = 1
    // Not counted: Körda mil per RC (CALCULATED DIVIDE)
    const kpis = [
      {
        id: "fyllnadsgrad",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "leveransprecision",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "resultat",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "antal-rc",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "korda-mil",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "sjuktimmar",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "ordinarie",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "sjukfranvaro",
        kind: "TARGET" as const,
        calcOperator: "RATIO_PERCENT" as const,
        calcNumeratorKpiId: "sjuktimmar",
        calcDenominatorKpiId: "ordinarie",
      },
      {
        id: "per-rc",
        kind: "CALCULATED" as const,
        calcOperator: "DIVIDE" as const,
        calcNumeratorKpiId: "korda-mil",
        calcDenominatorKpiId: "antal-rc",
      },
    ];

    const none = countKpiSetReportingProgress(kpis, new Set());
    assert.deepEqual(none, { reportedCount: 0, totalCount: 6 });

    const allManual = countKpiSetReportingProgress(
      kpis,
      new Set([
        "fyllnadsgrad",
        "leveransprecision",
        "resultat",
        "antal-rc",
        "korda-mil",
        "sjuktimmar",
        "ordinarie",
        "sjukfranvaro", // system-computed — must not add an extra point
        "per-rc", // calculated — must not add an extra point
      ]),
    );
    assert.deepEqual(allManual, { reportedCount: 6, totalCount: 6 });
  });
});
