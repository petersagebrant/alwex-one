import { formatKpiDisplayValue } from "../format/kpi";
import {
  computeEconomicDeviation,
  formatSignedEconomicValue,
  isMonthlyEconomicResultKpi,
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

export type MonthlyResultAiContext = {
  semanticRole: "latest_finalized_monthly_result";
  resultMonth: string | null;
  actualResult: string | null;
  budgetResult: string | null;
  deviation: string | null;
  status: string | null;
  pendingClosing: boolean;
  expectedResultMonth: string | null;
  targetValue: null;
};

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
}): MonthlyResultAiContext | null {
  if (!isMonthlyEconomicResultKpi(kpi)) return null;
  return {
    semanticRole: "latest_finalized_monthly_result",
    resultMonth: kpi.latestPeriodMonth ?? null,
    actualResult: kpi.latestActualValue ?? null,
    budgetResult: kpi.latestBudgetValue ?? null,
    deviation:
      formatSignedEconomicValue(
        computeEconomicDeviation(
          kpi.latestActualValue,
          kpi.latestBudgetValue,
        ) ?? kpi.currentValue,
      ),
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
