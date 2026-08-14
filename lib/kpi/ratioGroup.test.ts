import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectRatioGroupMemberIds,
  countDailyReportingProgress,
  findRatioPercentGroups,
} from "./ratioGroup";

describe("ratioGroup helpers", () => {
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
    calcNumeratorKpiId: null,
    calcDenominatorKpiId: null,
  };
  const sjukfranvaro = {
    id: "pct",
    kind: "TARGET" as const,
    calcOperator: "RATIO_PERCENT" as const,
    calcNumeratorKpiId: "num",
    calcDenominatorKpiId: "den",
  };
  const kordaMil = {
    id: "div",
    kind: "CALCULATED" as const,
    calcOperator: "DIVIDE" as const,
    calcNumeratorKpiId: "mil",
    calcDenominatorKpiId: "rc",
  };
  const mil = {
    id: "mil",
    kind: "STATISTIC" as const,
    calcOperator: null,
    calcNumeratorKpiId: null,
    calcDenominatorKpiId: null,
  };
  const rc = {
    id: "rc",
    kind: "STATISTIC" as const,
    calcOperator: null,
    calcNumeratorKpiId: null,
    calcDenominatorKpiId: null,
  };

  it("groups RATIO_PERCENT TARGET with its two STATISTIC inputs via calc FKs", () => {
    const groups = findRatioPercentGroups([
      sjuktimmar,
      ordinarie,
      sjukfranvaro,
      mil,
      rc,
      kordaMil,
    ]);
    assert.deepEqual(groups, [
      {
        resultKpiId: "pct",
        numeratorKpiId: "num",
        denominatorKpiId: "den",
      },
    ]);
  });

  it("skips DIVIDE and incomplete ratio links", () => {
    assert.deepEqual(
      findRatioPercentGroups([mil, rc, kordaMil]),
      [],
    );
    assert.deepEqual(
      findRatioPercentGroups([
        {
          ...sjukfranvaro,
          calcDenominatorKpiId: null,
        },
        sjuktimmar,
      ]),
      [],
    );
  });

  it("collects all member ids for filtering lists", () => {
    const ids = collectRatioGroupMemberIds([
      {
        resultKpiId: "pct",
        numeratorKpiId: "num",
        denominatorKpiId: "den",
      },
    ]);
    assert.equal(ids.size, 3);
    assert.ok(ids.has("pct"));
    assert.ok(ids.has("num"));
    assert.ok(ids.has("den"));
  });

  it("counts each ratio group as one reporting point, not its inputs", () => {
    // Kyl & Frys: Sjukfrånvaro (both hours) + Antal RC + Körda mil reported;
    // 3 other TARGET KPIs unreported. Separate DIVIDE (Körda mil per RC) omitted.
    const progress = countDailyReportingProgress({
      ratioGroups: [
        {
          numerator: { isReported: true },
          denominator: { isReported: true },
        },
      ],
      items: [
        { isReported: false }, // Fyllnadsgrad
        { isReported: false }, // Leveransprecision
        { isReported: false }, // Resultat mot budget
        { isReported: true }, // Antal RC
        { isReported: true }, // Körda mil
      ],
    });
    assert.deepEqual(progress, { reportedCount: 3, totalCount: 6 });
  });

  it("does not mark a ratio group reported until both inputs are complete", () => {
    const progress = countDailyReportingProgress({
      ratioGroups: [
        {
          numerator: { isReported: true },
          denominator: { isReported: false },
        },
      ],
      items: [{ isReported: true }],
    });
    assert.deepEqual(progress, { reportedCount: 1, totalCount: 2 });
  });

  it("ignores calculated KPIs when they are not passed into progress", () => {
    // Caller filters DIVIDE/CALCULATED into calculatedItems — not into items/groups.
    const progress = countDailyReportingProgress({
      ratioGroups: [],
      items: [
        { isReported: true }, // Antal RC
        { isReported: true }, // Körda mil
      ],
    });
    assert.deepEqual(progress, { reportedCount: 2, totalCount: 2 });
  });
});
