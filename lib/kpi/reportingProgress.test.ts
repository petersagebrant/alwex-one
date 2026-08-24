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

  it("Kyl & Frys: revenue adds exactly one; monthly result and MTD excluded", () => {
    // Standalone: Fyllnadsgrad, Leveransprecision, Antal RC, Körda mil, Omsättning idag
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
        id: "omsattning-idag",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "omsattning-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "omsattning-idag",
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
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
        reportingFrequency: "MONTHLY" as const,
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
        "omsattning-idag",
        "omsattning-mtd",
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

  it("Lager & Logistik: revenue increases daily progress from 5 to 6", () => {
    // Standalone daily: Beläggningsgrad, Kolli OOH, Kolli Byggmax, Arbetade timmar
    // Ratio block: Sjuktimmar + Ordinarie = 1
    // Not counted: Resultat (MONTHLY), system TARGET Kolli per arbetad timme
    const kpis = [
      {
        id: "belaggning",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "resultat",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "MONTHLY" as const,
      },
      {
        id: "omsattning-idag",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "omsattning-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "omsattning-idag",
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "kolli-ooh",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "kolli-byggmax",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "arbetade",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "sjuktimmar",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ordinarie",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "sjukfranvaro",
        kind: "TARGET" as const,
        calcOperator: "RATIO_PERCENT" as const,
        calcNumeratorKpiId: "sjuktimmar",
        calcDenominatorKpiId: "ordinarie",
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "kolli-per-timme",
        kind: "TARGET" as const,
        calcOperator: "SUM_DIVIDE" as const,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: "arbetade",
        reportingFrequency: "DAILY" as const,
      },
    ];

    const none = countKpiSetReportingProgress(kpis, new Set());
    assert.deepEqual(none, { reportedCount: 0, totalCount: 6 });

    const allDaily = countKpiSetReportingProgress(
      kpis,
      new Set([
        "belaggning",
        "resultat", // monthly — must not add
        "omsattning-idag",
        "omsattning-mtd",
        "kolli-ooh",
        "kolli-byggmax",
        "arbetade",
        "sjuktimmar",
        "ordinarie",
        "sjukfranvaro",
        "kolli-per-timme",
      ]),
    );
    assert.deepEqual(allDaily, { reportedCount: 6, totalCount: 6 });
  });

  it("Fjärr & Miljö reuses revenue as one point and excludes MTD/result", () => {
    // Standalone daily: Omsättning, Körda mil
    // Ratio block: Sjuktimmar + Ordinarie = 1
    // Not counted: Resultat (MONTHLY), Kr per mil (CALCULATED DIVIDE)
    const kpis = [
      {
        id: "omsattning",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "omsattning-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "omsattning",
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "korda-mil",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "kr-per-mil",
        kind: "CALCULATED" as const,
        calcOperator: "DIVIDE" as const,
        calcNumeratorKpiId: "omsattning",
        calcDenominatorKpiId: "korda-mil",
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "resultat",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "MONTHLY" as const,
      },
      {
        id: "sjuktimmar",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ordinarie",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "sjukfranvaro",
        kind: "TARGET" as const,
        calcOperator: "RATIO_PERCENT" as const,
        calcNumeratorKpiId: "sjuktimmar",
        calcDenominatorKpiId: "ordinarie",
        reportingFrequency: "DAILY" as const,
      },
    ];

    const none = countKpiSetReportingProgress(kpis, new Set());
    assert.deepEqual(none, { reportedCount: 0, totalCount: 3 });

    const allDaily = countKpiSetReportingProgress(
      kpis,
      new Set([
        "omsattning",
        "omsattning-mtd",
        "korda-mil",
        "kr-per-mil", // calculated — must not add
        "resultat", // monthly — must not add
        "sjuktimmar",
        "ordinarie",
        "sjukfranvaro",
      ]),
    );
    assert.deepEqual(allDaily, { reportedCount: 3, totalCount: 3 });
  });

  it("Mark & Anläggning: revenue increases daily progress from 5 to 6", () => {
    // Standalone daily: Ton ut Snugge, Kubik ut Betongstationen, Antal enheter i drift
    // Separate daily inputs: Sjuktimmar + Ordinarie arbetstid = 2
    // Calculated Sjukfrånvaro remains excluded.
    // Not counted: Resultat mot budget (MONTHLY)
    const kpis = [
      {
        id: "resultat",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "MONTHLY" as const,
      },
      {
        id: "omsattning-idag",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "omsattning-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "omsattning-idag",
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ton-snugge",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "kubik-betong",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "enheter-drift",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "sjuktimmar",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ordinarie",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "sjukfranvaro",
        kind: "TARGET" as const,
        calcOperator: "RATIO_PERCENT" as const,
        calcNumeratorKpiId: "sjuktimmar",
        calcDenominatorKpiId: "ordinarie",
        ratioReportingMode: "SEPARATE_INPUTS" as const,
        reportingFrequency: "DAILY" as const,
      },
    ];

    const none = countKpiSetReportingProgress(kpis, new Set());
    assert.deepEqual(none, { reportedCount: 0, totalCount: 6 });

    const onlySickHours = countKpiSetReportingProgress(
      kpis,
      new Set(["sjuktimmar"]),
    );
    assert.deepEqual(onlySickHours, { reportedCount: 1, totalCount: 6 });

    const allDaily = countKpiSetReportingProgress(
      kpis,
      new Set([
        "resultat", // monthly — must not add
        "omsattning-idag",
        "omsattning-mtd",
        "ton-snugge",
        "kubik-betong",
        "enheter-drift",
        "sjuktimmar",
        "ordinarie",
        "sjukfranvaro",
      ]),
    );
    assert.deepEqual(allDaily, { reportedCount: 6, totalCount: 6 });
  });

  it("excludes MONTHLY STATISTIC from daily progress like TARGET MONTHLY", () => {
    const kpis = [
      {
        id: "daily-stat",
        kind: "STATISTIC" as const,
        calcOperator: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "monthly-stat",
        kind: "STATISTIC" as const,
        calcOperator: null,
        reportingFrequency: "MONTHLY" as const,
      },
      {
        id: "monthly-target",
        kind: "TARGET" as const,
        calcOperator: null,
        reportingFrequency: "MONTHLY" as const,
      },
      {
        id: "daily-target",
        kind: "TARGET" as const,
        calcOperator: null,
        reportingFrequency: "DAILY" as const,
      },
    ];
    const result = countKpiSetReportingProgress(
      kpis,
      new Set(["daily-stat", "monthly-stat", "monthly-target", "daily-target"]),
    );
    assert.deepEqual(result, { reportedCount: 2, totalCount: 2 });
  });
});
