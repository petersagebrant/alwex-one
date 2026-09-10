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

  it("Kyl & Frys: monthly revenue vs budget is excluded from daily progress", () => {
    // Standalone: two Fyllnadsgrad splits, Intjänandegrad, Leveransprecision,
    // Antal RC, Körda mil, Övertid
    // Ratio block: Sjuktimmar + Ordinarie (+ Sjukfrånvaro result) = 1
    // Not counted: Körda mil per RC (CALCULATED DIVIDE), Övertid MTD (CALCULATED),
    // Resultat/Omsättning MONTHLY
    const kpis = [
      {
        id: "fyllnadsgrad-mellan",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "fyllnadsgrad-dist",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "intjanandegrad",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "omsattning-mot-budget",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "MONTHLY" as const,
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
        id: "overtid",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
      {
        id: "overtid-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "overtid",
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
    assert.deepEqual(none, { reportedCount: 0, totalCount: 8 });

    const allManual = countKpiSetReportingProgress(
      kpis,
      new Set([
        "fyllnadsgrad-mellan",
        "fyllnadsgrad-dist",
        "intjanandegrad",
        "leveransprecision",
        "resultat",
        "omsattning-mot-budget",
        "antal-rc",
        "korda-mil",
        "overtid",
        "overtid-mtd", // calculated — must not add an extra point
        "sjuktimmar",
        "ordinarie",
        "sjukfranvaro", // system-computed — must not add an extra point
        "per-rc", // calculated — must not add an extra point
      ]),
    );
    assert.deepEqual(allManual, { reportedCount: 8, totalCount: 8 });
  });

  it("Lager & Logistik: monthly revenue vs budget is excluded from daily progress", () => {
    // Standalone daily: Beläggningsgrad, Kolli, Övertid
    // Ratio block: Sjuktimmar + Ordinarie (+ Sjukfrånvaro result) = 1
    // Not counted: Resultat/Omsättning MONTHLY; Övertid månad hittills (CALCULATED)
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
        id: "omsattning-mot-budget",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "MONTHLY" as const,
      },
      {
        id: "kolli",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "overtid",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "overtid-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "overtid",
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
    ];

    const none = countKpiSetReportingProgress(kpis, new Set());
    assert.deepEqual(none, { reportedCount: 0, totalCount: 4 });

    const allDaily = countKpiSetReportingProgress(
      kpis,
      new Set([
        "belaggning",
        "resultat", // monthly — must not add
        "omsattning-mot-budget", // monthly — must not add
        "kolli",
        "overtid",
        "overtid-mtd", // calculated — must not add
        "sjuktimmar",
        "ordinarie",
        "sjukfranvaro",
      ]),
    );
    assert.deepEqual(allDaily, { reportedCount: 4, totalCount: 4 });
  });

  it("Fjärr & Miljö: monthly revenue vs budget is excluded from daily progress", () => {
    // Standalone daily: Kr per mil – Elit, Kr per mil – Fjärr, Övertid
    // Ratio block: Sjuktimmar + Ordinarie = 1
    // Not counted: Resultat/Omsättning MONTHLY, Övertid MTD (CALCULATED)
    const kpis = [
      {
        id: "omsattning-mot-budget",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "MONTHLY" as const,
      },
      {
        id: "kr-per-mil-elit",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "kr-per-mil-fjarr",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "overtid",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "overtid-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "overtid",
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
    assert.deepEqual(none, { reportedCount: 0, totalCount: 4 });

    const allDaily = countKpiSetReportingProgress(
      kpis,
      new Set([
        "omsattning-mot-budget",
        "kr-per-mil-elit",
        "kr-per-mil-fjarr",
        "overtid",
        "overtid-mtd", // calculated — must not add
        "resultat", // monthly — must not add
        "sjuktimmar",
        "ordinarie",
        "sjukfranvaro",
      ]),
    );
    assert.deepEqual(allDaily, { reportedCount: 4, totalCount: 4 });
  });

  it("Mark & Anläggning: monthly revenue vs budget is excluded from daily progress", () => {
    // Standalone daily: Antal enheter i drift, Kubik ut Betongstationen,
    // Ton ut Snugge, Ton in Tunatorp, Ton ut Tunatorp, Övertid
    // Separate daily inputs: Sjuktimmar + Ordinarie arbetstid = 2
    // (MONTH_TO_DATE_RATIO_PERCENT + SEPARATE_INPUTS — not one grouped block)
    // Calculated Sjukfrånvaro remains excluded.
    // Not counted: Resultat/Omsättning MONTHLY; Övertid MTD / Tunatorp MTD (CALCULATED)
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
        id: "omsattning-mot-budget",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "MONTHLY" as const,
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
        id: "kubik-betong",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
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
        id: "ton-in-tunatorp",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ton-in-tunatorp-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "ton-in-tunatorp",
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ton-ut-tunatorp",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ton-ut-tunatorp-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "ton-ut-tunatorp",
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "overtid",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "overtid-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "overtid",
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
        calcOperator: "MONTH_TO_DATE_RATIO_PERCENT" as const,
        calcNumeratorKpiId: "sjuktimmar",
        calcDenominatorKpiId: "ordinarie",
        ratioReportingMode: "SEPARATE_INPUTS" as const,
        reportingFrequency: "DAILY" as const,
      },
    ];

    const none = countKpiSetReportingProgress(kpis, new Set());
    assert.deepEqual(none, { reportedCount: 0, totalCount: 8 });

    const onlySickHours = countKpiSetReportingProgress(
      kpis,
      new Set(["sjuktimmar"]),
    );
    assert.deepEqual(onlySickHours, { reportedCount: 1, totalCount: 8 });

    const allDaily = countKpiSetReportingProgress(
      kpis,
      new Set([
        "resultat", // monthly — must not add
        "omsattning-mot-budget", // monthly — must not add
        "enheter-drift",
        "kubik-betong",
        "ton-snugge",
        "ton-in-tunatorp",
        "ton-in-tunatorp-mtd", // calculated — must not add
        "ton-ut-tunatorp",
        "ton-ut-tunatorp-mtd", // calculated — must not add
        "overtid",
        "overtid-mtd", // calculated — must not add
        "sjuktimmar",
        "ordinarie",
        "sjukfranvaro", // system-computed — must not add
      ]),
    );
    assert.deepEqual(allDaily, { reportedCount: 8, totalCount: 8 });
  });

  it("Recycling: daily progress is 4/4 (Ton in, Ton ut, Övertid, Sjukfrånvaro group)", () => {
    // Standalone daily: Ton in idag, Ton ut idag, Övertid
    // Ratio block: Sjuktimmar + Ordinarie (+ Sjukfrånvaro result) = 1 GROUPED
    // Not counted: Ton/Övertid MTD (CALCULATED); Sjukfrånvaro result;
    // Resultat/Omsättning MONTHLY
    const kpis = [
      {
        id: "ton-in",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ton-in-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "ton-in",
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ton-ut",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "ton-ut-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "ton-ut",
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "overtid",
        kind: "STATISTIC" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "overtid-mtd",
        kind: "CALCULATED" as const,
        calcOperator: "MONTH_TO_DATE_SUM" as const,
        calcNumeratorKpiId: "overtid",
        calcDenominatorKpiId: null,
        reportingFrequency: "DAILY" as const,
      },
      {
        id: "omsattning-mot-budget",
        kind: "TARGET" as const,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
        reportingFrequency: "MONTHLY" as const,
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
        ratioReportingMode: "GROUPED" as const,
        reportingFrequency: "DAILY" as const,
      },
    ];

    const none = countKpiSetReportingProgress(kpis, new Set());
    assert.deepEqual(none, { reportedCount: 0, totalCount: 4 });

    const allDaily = countKpiSetReportingProgress(
      kpis,
      new Set([
        "ton-in",
        "ton-in-mtd", // calculated — must not add
        "ton-ut",
        "ton-ut-mtd", // calculated — must not add
        "overtid",
        "overtid-mtd", // calculated — must not add
        "omsattning-mot-budget", // monthly — must not add
        "resultat", // monthly — must not add
        "sjuktimmar",
        "ordinarie",
        "sjukfranvaro", // system-computed — must not add
      ]),
    );
    assert.deepEqual(allDaily, { reportedCount: 4, totalCount: 4 });
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
