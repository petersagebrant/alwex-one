import { formatKpiDisplayValue } from "../format/kpi";
import {
  computeEconomicDeviation,
  computeEconomicDeviationPercent,
  computeYearToDateEconomicSum,
  formatEconomicMarginPercent,
  formatEconomicPercent,
  formatPeriodMonthSv,
  formatSignedEconomicValue,
  isMonthlyEconomicKpi,
  isMonthlyEconomicResultKpi,
  isMonthlyRevenueVsBudgetKpi,
} from "./economics";

type MonthlyResultPresentationInput = {
  kpiName: string;
  unit: string | null;
  periodLabel: string;
  isReported: boolean;
  pendingLabel?: string | null;
  expectedFinalizationLabel?: string | null;
  actualValue?: string | null;
  budgetValue?: string | null;
  status?: string | null;
};

export type MonthlyResultPresentation = {
  title: string;
  resultMonth: string;
  pendingLabel: string | null;
  expectedFinalizationLabel: string | null;
  actualValue: string | null;
  budgetValue: string | null;
  deviationValue: string | null;
  statusValue: string | null;
};

export type MonthlyEconomicOperandRow = {
  periodMonth?: string | null;
  actualValue?: string | null;
  budgetValue?: string | null;
};

export type MonthlyEconomicPictureLine = {
  actualValue: string | null;
  budgetValue: string | null;
  deviationValue: string | null;
  deviationPercent: string | null;
  statusValue: string | null;
  isReported: boolean;
};

export type MonthlyEconomicYtdLine = {
  actualValue: string | null;
  budgetValue: string | null;
  deviationValue: string | null;
  deviationPercent: string | null;
};

export type MonthlyEconomicPicture = {
  periodMonth: string;
  periodLabel: string;
  result: MonthlyEconomicPictureLine;
  revenue: MonthlyEconomicPictureLine;
  margin: string | null;
  ytdRevenue: MonthlyEconomicYtdLine;
  ytdResult: MonthlyEconomicYtdLine;
  ytdResultActual: string | null;
  ytdResultBudget: string | null;
  resultHref: string | null;
};

export type AoEconomicCardKind = "revenue" | "result" | "margin" | "ytdResult";

export type AoEconomicCard = {
  kind: AoEconomicCardKind;
  title: string;
  helperText: string | null;
  actualValue: string | null;
  budgetValue: string | null;
  deviationValue: string | null;
  percentValue: string | null;
};

/** AO huvudvy heading: lowercase Swedish month + year, e.g. juli 2026. */
export function aoEconomicPictureHeading(periodMonth: string): string {
  return `Månadens ekonomiska bild – ${formatPeriodMonthSv(periodMonth, {
    includeYear: true,
    capitalize: false,
  })}`;
}

/**
 * Four cards for the AO main view. Percent and YTD revenue stay on the
 * picture object (detail/AI/history) but are not listed here.
 */
export function buildAoEconomicCards(
  picture: MonthlyEconomicPicture,
): AoEconomicCard[] {
  return [
    {
      kind: "revenue",
      title: "Omsättning",
      helperText: null,
      actualValue: picture.revenue.actualValue,
      budgetValue: picture.revenue.budgetValue,
      deviationValue: picture.revenue.deviationValue,
      percentValue: null,
    },
    {
      kind: "result",
      title: "Resultat",
      helperText: null,
      actualValue: picture.result.actualValue,
      budgetValue: picture.result.budgetValue,
      deviationValue: picture.result.deviationValue,
      percentValue: null,
    },
    {
      kind: "margin",
      title: "Resultatmarginal",
      helperText: null,
      actualValue: null,
      budgetValue: null,
      deviationValue: null,
      percentValue: picture.margin,
    },
    {
      kind: "ytdResult",
      title: "Ackumulerat resultat",
      helperText: "Resultat från årets början",
      actualValue: picture.ytdResult.actualValue,
      budgetValue: picture.ytdResult.budgetValue,
      deviationValue: picture.ytdResult.deviationValue,
      percentValue: null,
    },
  ];
}

/** Filter Resultat/Omsättning mot budget out of the ordinary AO KPI table. */
export function isHiddenFromAreaKpiList(kpi: {
  name: string;
  reportingFrequency?: string | null;
}): boolean {
  return isMonthlyEconomicKpi(kpi);
}

export type MonthlyResultAiContext = {
  semanticRole:
    | "latest_finalized_monthly_result"
    | "latest_finalized_monthly_revenue_vs_budget";
  periodMonth: string | null;
  resultMonth: string | null;
  actualResult: string | null;
  budgetResult: string | null;
  deviation: string | null;
  resultDeviationPercent: string | null;
  actualRevenue: string | null;
  budgetRevenue: string | null;
  revenueDeviation: string | null;
  revenueDeviationPercent: string | null;
  margin: string | null;
  ytdResultActual: string | null;
  ytdResultBudget: string | null;
  ytdRevenueActual: string | null;
  ytdRevenueBudget: string | null;
  status: string | null;
  pendingClosing: boolean;
  expectedResultMonth: string | null;
  targetValue: null;
};

function pictureLine(input: {
  actualValue?: string | null;
  budgetValue?: string | null;
  status?: string | null;
  unit?: string | null;
  isReported: boolean;
}): MonthlyEconomicPictureLine {
  if (!input.isReported) {
    return {
      actualValue: null,
      budgetValue: null,
      deviationValue: null,
      deviationPercent: null,
      statusValue: null,
      isReported: false,
    };
  }
  return {
    actualValue: formatKpiDisplayValue(input.actualValue, input.unit),
    budgetValue: formatKpiDisplayValue(input.budgetValue, input.unit),
    deviationValue: formatKpiDisplayValue(
      formatSignedEconomicValue(
        computeEconomicDeviation(input.actualValue, input.budgetValue),
      ),
      input.unit,
    ),
    deviationPercent: formatEconomicPercent(
      computeEconomicDeviationPercent(input.actualValue, input.budgetValue),
    ),
    statusValue: input.status?.trim() || null,
    isReported: true,
  };
}

function ytdLine(
  rows: MonthlyEconomicOperandRow[],
  periodMonth: string,
  unit?: string | null,
): MonthlyEconomicYtdLine {
  const ytd = computeYearToDateEconomicSum(rows, periodMonth);
  return {
    actualValue: formatKpiDisplayValue(ytd.actualValue, unit),
    budgetValue: formatKpiDisplayValue(ytd.budgetValue, unit),
    deviationValue: formatKpiDisplayValue(
      formatSignedEconomicValue(
        computeEconomicDeviation(ytd.actualValue, ytd.budgetValue),
      ),
      unit,
    ),
    deviationPercent: formatEconomicPercent(
      computeEconomicDeviationPercent(ytd.actualValue, ytd.budgetValue),
    ),
  };
}

/** Compose månadens ekonomiska bild from Resultat + sibling Omsättning. */
export function buildMonthlyEconomicPicture(input: {
  periodMonth: string;
  unit?: string | null;
  result?: {
    actualValue?: string | null;
    budgetValue?: string | null;
    status?: string | null;
    isReported?: boolean;
  } | null;
  revenue?: {
    actualValue?: string | null;
    budgetValue?: string | null;
    status?: string | null;
    isReported?: boolean;
  } | null;
  resultHistory?: MonthlyEconomicOperandRow[];
  revenueHistory?: MonthlyEconomicOperandRow[];
  resultHref?: string | null;
}): MonthlyEconomicPicture {
  const resultReported = Boolean(
    input.result?.isReported &&
      input.result.actualValue &&
      input.result.budgetValue,
  );
  const revenueReported = Boolean(
    input.revenue?.isReported &&
      input.revenue.actualValue &&
      input.revenue.budgetValue,
  );
  const ytdResult = ytdLine(
    input.resultHistory ?? [],
    input.periodMonth,
    input.unit,
  );
  const ytdRevenue = ytdLine(
    input.revenueHistory ?? [],
    input.periodMonth,
    input.unit,
  );
  return {
    periodMonth: input.periodMonth,
    periodLabel: formatPeriodMonthSv(input.periodMonth, { includeYear: true }),
    result: pictureLine({
      actualValue: input.result?.actualValue,
      budgetValue: input.result?.budgetValue,
      status: input.result?.status,
      unit: input.unit,
      isReported: resultReported,
    }),
    revenue: pictureLine({
      actualValue: input.revenue?.actualValue,
      budgetValue: input.revenue?.budgetValue,
      status: input.revenue?.status,
      unit: input.unit,
      isReported: revenueReported,
    }),
    margin:
      resultReported && revenueReported
        ? formatEconomicMarginPercent(
            input.result?.actualValue,
            input.revenue?.actualValue,
          )
        : null,
    ytdRevenue,
    ytdResult,
    ytdResultActual: ytdResult.actualValue,
    ytdResultBudget: ytdResult.budgetValue,
    resultHref: input.resultHref ?? null,
  };
}

/** AI-safe shape: deviation is never exposed as a generic current/actual value. */
export function buildMonthlyResultAiContext(kpi: {
  name: string;
  reportingFrequency?: string | null;
  latestPeriodMonth?: string | null;
  expectedPeriodMonth?: string | null;
  latestActualValue?: string | null;
  latestBudgetValue?: string | null;
  currentValue?: string | null;
  status?: string | null;
  isPeriodPending?: boolean;
  latestYtdActualValue?: string | null;
  latestYtdBudgetValue?: string | null;
  latestYtdRevenueActualValue?: string | null;
  latestYtdRevenueBudgetValue?: string | null;
  revenueActualValue?: string | null;
  revenueBudgetValue?: string | null;
  resultHistory?: MonthlyEconomicOperandRow[];
  revenueHistory?: MonthlyEconomicOperandRow[];
}): MonthlyResultAiContext | null {
  const isResult = isMonthlyEconomicResultKpi(kpi);
  const isRevenue =
    kpi.reportingFrequency === "MONTHLY" && isMonthlyRevenueVsBudgetKpi(kpi);
  if (!isResult && !isRevenue) return null;

  const periodMonth = kpi.latestPeriodMonth ?? null;
  const actualResult = isResult
    ? kpi.latestActualValue ?? null
    : null;
  const budgetResult = isResult
    ? kpi.latestBudgetValue ?? null
    : null;
  const actualRevenue = isResult
    ? kpi.revenueActualValue ?? null
    : kpi.latestActualValue ?? null;
  const budgetRevenue = isResult
    ? kpi.revenueBudgetValue ?? null
    : kpi.latestBudgetValue ?? null;
  const ytdThrough = periodMonth ?? kpi.expectedPeriodMonth ?? null;
  const ytdFrom = (
    rows: MonthlyEconomicOperandRow[] | undefined,
    fallbackActual: string | null,
    fallbackBudget: string | null,
  ) =>
    rows && ytdThrough
      ? computeYearToDateEconomicSum(rows, ytdThrough)
      : { actualValue: fallbackActual, budgetValue: fallbackBudget };
  const ytdResult = ytdFrom(
    kpi.resultHistory,
    isResult ? kpi.latestYtdActualValue ?? null : null,
    isResult ? kpi.latestYtdBudgetValue ?? null : null,
  );
  const ytdRevenue = ytdFrom(
    kpi.revenueHistory ?? (isRevenue ? kpi.resultHistory : undefined),
    isRevenue
      ? kpi.latestYtdActualValue ?? null
      : kpi.latestYtdRevenueActualValue ?? null,
    isRevenue
      ? kpi.latestYtdBudgetValue ?? null
      : kpi.latestYtdRevenueBudgetValue ?? null,
  );

  return {
    semanticRole: isResult
      ? "latest_finalized_monthly_result"
      : "latest_finalized_monthly_revenue_vs_budget",
    periodMonth,
    resultMonth: periodMonth,
    actualResult,
    budgetResult,
    deviation: isResult
      ? formatSignedEconomicValue(
          computeEconomicDeviation(
            kpi.latestActualValue,
            kpi.latestBudgetValue,
          ) ?? kpi.currentValue,
        )
      : formatSignedEconomicValue(
          computeEconomicDeviation(actualRevenue, budgetRevenue) ??
            kpi.currentValue,
        ),
    resultDeviationPercent: formatEconomicPercent(
      computeEconomicDeviationPercent(actualResult, budgetResult),
    ),
    actualRevenue,
    budgetRevenue,
    revenueDeviation: formatSignedEconomicValue(
      computeEconomicDeviation(actualRevenue, budgetRevenue),
    ),
    revenueDeviationPercent: formatEconomicPercent(
      computeEconomicDeviationPercent(actualRevenue, budgetRevenue),
    ),
    margin: formatEconomicMarginPercent(actualResult, actualRevenue),
    ytdResultActual: ytdResult.actualValue,
    ytdResultBudget: ytdResult.budgetValue,
    ytdRevenueActual: ytdRevenue.actualValue,
    ytdRevenueBudget: ytdRevenue.budgetValue,
    status: kpi.isPeriodPending ? null : kpi.status?.trim() || null,
    pendingClosing: kpi.isPeriodPending ?? false,
    expectedResultMonth: kpi.expectedPeriodMonth ?? null,
    targetValue: null,
  };
}

/**
 * Presentation-only model for the monthly economic result card.
 * Budget is an entered operand, not a traditional KPI target.
 */
export function buildMonthlyResultPresentation({
  kpiName,
  unit,
  periodLabel,
  isReported,
  pendingLabel,
  expectedFinalizationLabel,
  actualValue,
  budgetValue,
  status,
}: MonthlyResultPresentationInput): MonthlyResultPresentation {
  if (!isReported) {
    return {
      title: `${kpiName} – ${periodLabel}`,
      resultMonth: periodLabel,
      pendingLabel: pendingLabel ?? "Inväntar bokslut",
      expectedFinalizationLabel: expectedFinalizationLabel ?? null,
      actualValue: null,
      budgetValue: null,
      deviationValue: null,
      statusValue: null,
    };
  }

  return {
    title: `${kpiName} – ${periodLabel}`,
    resultMonth: periodLabel,
    pendingLabel: null,
    expectedFinalizationLabel: null,
    actualValue: formatKpiDisplayValue(actualValue, unit),
    budgetValue: formatKpiDisplayValue(budgetValue, unit),
    deviationValue: formatKpiDisplayValue(
      formatSignedEconomicValue(
        computeEconomicDeviation(actualValue, budgetValue),
      ),
      unit,
    ),
    statusValue: status?.trim() || null,
  };
}
