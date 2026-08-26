import { parseNumeric } from "@/lib/kpi/parseNumeric";

const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";
const SWEDISH_MONTHS = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
] as const;

export type MonthlyResultState = {
  expectedPeriodMonth: string;
  expectedPeriodLabel: string;
  expectedFinalizationDate: string;
  expectedFinalizationLabel: string;
  latestFinalizedPeriodMonth: string | null;
  latestFinalizedPeriodLabel: string | null;
  isExpectedPeriodFinalized: boolean;
  isPending: boolean;
};

export type MonthlyEconomicValues = {
  actualValue: string | null;
  budgetValue: string | null;
  deviationValue: string | null;
  isComplete: boolean;
  isLegacyDeviation: boolean;
};

export function formatEconomicNumber(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return String(Object.is(rounded, -0) ? 0 : rounded).replace(".", ",");
}

export function computeEconomicDeviation(
  actualValue: string | number | null | undefined,
  budgetValue: string | number | null | undefined,
): string | null {
  const actual = parseNumeric(actualValue);
  const budget = parseNumeric(budgetValue);
  if (actual === null || budget === null) return null;
  return formatEconomicNumber(actual - budget);
}

/** (actual − budget) / |budget| as percentage points; null if budget is 0. */
export function computeEconomicDeviationPercent(
  actualValue: string | number | null | undefined,
  budgetValue: string | number | null | undefined,
): string | null {
  const actual = parseNumeric(actualValue);
  const budget = parseNumeric(budgetValue);
  if (actual === null || budget === null || budget === 0) return null;
  return formatEconomicNumber(((actual - budget) / Math.abs(budget)) * 100);
}

function formatEconomicNumberFixed(value: number, decimals: number): string {
  const factor = 10 ** decimals;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toFixed(decimals).replace(".", ",");
}

/**
 * result_actual / revenue_actual × 100 (already percentage points, one decimal).
 * Null if revenue actual is 0 or missing. Do not pass this through a second ×100.
 */
export function computeEconomicMargin(
  resultActual: string | number | null | undefined,
  revenueActual: string | number | null | undefined,
): string | null {
  const result = parseNumeric(resultActual);
  const revenue = parseNumeric(revenueActual);
  if (result === null || revenue === null || revenue === 0) return null;
  return formatEconomicNumberFixed((result / revenue) * 100, 1);
}

/** Margin display: one decimal, Swedish comma, no extra ×100. Example: `8,9 %`. */
export function formatEconomicMarginPercent(
  resultActual: string | number | null | undefined,
  revenueActual: string | number | null | undefined,
): string | null {
  const margin = computeEconomicMargin(resultActual, revenueActual);
  return margin === null ? null : `${margin} %`;
}

export function formatEconomicPercent(
  value: string | number | null | undefined,
): string | null {
  const signed = formatSignedEconomicValue(value);
  return signed ? `${signed} %` : null;
}

export type YearToDateEconomicSum = {
  actualValue: string | null;
  budgetValue: string | null;
};

/**
 * Sum actual/budget for period_months in the calendar year through the
 * selected month. Missing months are skipped (not treated as zero).
 */
export function computeYearToDateEconomicSum(
  rows: Array<{
    periodMonth?: string | null;
    actualValue?: string | number | null;
    budgetValue?: string | number | null;
  }>,
  throughPeriodMonth: string,
): YearToDateEconomicSum {
  const through = normalizePeriodMonth(throughPeriodMonth);
  const yearStart = `${through.slice(0, 4)}-01-01`;
  let actualSum = 0;
  let budgetSum = 0;
  let foundActual = false;
  let foundBudget = false;
  const seenActual = new Set<string>();
  const seenBudget = new Set<string>();
  for (const row of rows) {
    if (!row.periodMonth) continue;
    const period = normalizePeriodMonth(row.periodMonth);
    if (period < yearStart || period > through) continue;
    const actual = parseNumeric(row.actualValue);
    if (actual !== null && !seenActual.has(period)) {
      seenActual.add(period);
      foundActual = true;
      actualSum += actual;
    }
    const budget = parseNumeric(row.budgetValue);
    if (budget !== null && !seenBudget.has(period)) {
      seenBudget.add(period);
      foundBudget = true;
      budgetSum += budget;
    }
  }
  return {
    actualValue: foundActual ? formatEconomicNumber(actualSum) : null,
    budgetValue: foundBudget ? formatEconomicNumber(budgetSum) : null,
  };
}

const RESULT_VS_BUDGET_NAME = "resultat mot budget";
const REVENUE_VS_BUDGET_NAME = "omsättning mot budget";

function normalizedKpiName(name: string | null | undefined): string {
  return (name ?? "").trim().toLocaleLowerCase("sv-SE");
}

/** Presentation-only identity check; other monthly KPIs keep normal target rendering. */
export function isMonthlyEconomicResultKpi(kpi: {
  name: string;
  reportingFrequency?: string | null;
}): boolean {
  return (
    kpi.reportingFrequency === "MONTHLY" &&
    normalizedKpiName(kpi.name) === RESULT_VS_BUDGET_NAME
  );
}

/**
 * Sibling of Resultat mot budget (same TARGET MONTHLY G/Y/R model).
 * Resultat remains the huvud-KPI; this name is excluded from key KPIs,
 * area operational lights, VD attention and TARGET status pills so two
 * economy KPIs cannot double-count as two red/yellow lights.
 */
export function isMonthlyRevenueVsBudgetKpi(kpi: {
  name?: string | null;
}): boolean {
  return normalizedKpiName(kpi.name) === REVENUE_VS_BUDGET_NAME;
}

/** Resultat mot budget or Omsättning mot budget — monthly economic operands. */
export function isMonthlyEconomicKpi(kpi: {
  name: string;
  reportingFrequency?: string | null;
}): boolean {
  return (
    isMonthlyEconomicResultKpi(kpi) ||
    (kpi.reportingFrequency === "MONTHLY" && isMonthlyRevenueVsBudgetKpi(kpi))
  );
}

export function monthlyEconomicOperandLabels(kpi: { name?: string | null }): {
  actual: string;
  budget: string;
  missingPair: string;
} {
  if (isMonthlyRevenueVsBudgetKpi(kpi)) {
    return {
      actual: "Faktisk omsättning",
      budget: "Budgeterad omsättning",
      missingPair: "omsättning och budget",
    };
  }
  return {
    actual: "Faktiskt resultat",
    budget: "Budgeterat resultat",
    missingPair: "resultat och budget",
  };
}

export function formatSignedEconomicValue(
  value: string | number | null | undefined,
): string | null {
  const numeric = parseNumeric(value);
  if (numeric === null) return null;
  const formatted = formatEconomicNumber(numeric);
  return numeric > 0 ? `+${formatted}` : formatted;
}

export type EconomicValueTone = "positive" | "negative" | "neutral";

/**
 * Display color for signed economic values.
 * Deviation vs budget: zero is neutral. Result/margin: pass `{ zero: "positive" }`
 * so a break-even actual result is green.
 */
export function economicSignedTone(
  value: string | number | null | undefined,
  options?: { zero?: "positive" | "neutral" },
): EconomicValueTone {
  const numeric = parseNumeric(value);
  if (numeric === null) return "neutral";
  if (numeric > 0) return "positive";
  if (numeric < 0) return "negative";
  return options?.zero ?? "neutral";
}

export function resolveMonthlyEconomicValues(input: {
  actualValue?: string | null;
  budgetValue?: string | null;
  deviationValue?: string | null;
}): MonthlyEconomicValues {
  const actualValue = input.actualValue?.trim() || null;
  const budgetValue = input.budgetValue?.trim() || null;
  const computed = computeEconomicDeviation(actualValue, budgetValue);
  const storedDeviation = input.deviationValue?.trim() || null;
  return {
    actualValue,
    budgetValue,
    deviationValue: computed ?? storedDeviation,
    isComplete: computed !== null,
    isLegacyDeviation:
      computed === null && storedDeviation !== null && !actualValue && !budgetValue,
  };
}

export function formatMonthlyEconomicSummary(input: {
  actualValue?: string | null;
  budgetValue?: string | null;
  deviationValue?: string | null;
  unit?: string | null;
  periodMonth?: string | null;
  status?: string | null;
  kpiName?: string | null;
}): string {
  const values = resolveMonthlyEconomicValues(input);
  const labels = monthlyEconomicOperandLabels({ name: input.kpiName });
  const unit = input.unit?.trim() ? ` ${input.unit.trim()}` : "";
  const period = input.periodMonth
    ? `Resultatmånad: ${formatPeriodMonthSv(input.periodMonth, { includeYear: true })}. `
    : "";
  const status = input.status?.trim() ? `. Status: ${input.status.trim()}` : "";
  if (values.isLegacyDeviation) {
    return `${period}Äldre avvikelse: ${values.deviationValue}${unit} (${labels.missingPair} saknas)${status}`;
  }
  if (!values.isComplete) {
    const expected = input.periodMonth
      ? ` Förväntas omkring ${formatExpectedFinalizationSv(input.periodMonth)}.`
      : "";
    return `${period}Inväntar bokslut – ${labels.missingPair} måste registreras.${expected}`;
  }
  const deviation = formatSignedEconomicValue(values.deviationValue);
  return `${period}${labels.actual}: ${values.actualValue}${unit}. ${labels.budget}: ${values.budgetValue}${unit}. Avvikelse: ${deviation}${unit}${status}`;
}

function stockholmDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

export function normalizePeriodMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value.trim());
  if (!match) throw new Error("Period måste vara YYYY-MM eller YYYY-MM-DD.");
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("Ogiltig månad.");
  return `${match[1]}-${match[2]}-01`;
}

export function expectedResultPeriodMonth(now = new Date()): string {
  const { year, month } = stockholmDateParts(now);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  return `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`;
}

export function expectedResultFinalizationDate(periodMonth: string): string {
  const normalized = normalizePeriodMonth(periodMonth);
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(5, 7));
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-22`;
}

export function formatPeriodMonthSv(
  periodMonth: string,
  options?: { includeYear?: boolean; capitalize?: boolean },
): string {
  const normalized = normalizePeriodMonth(periodMonth);
  const month = Number(normalized.slice(5, 7));
  const year = normalized.slice(0, 4);
  let label: string = SWEDISH_MONTHS[month - 1];
  if (options?.capitalize !== false) {
    label = `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  }
  return options?.includeYear ? `${label} ${year}` : label;
}

export function formatExpectedFinalizationSv(periodMonth: string): string {
  const date = expectedResultFinalizationDate(periodMonth);
  const day = Number(date.slice(8, 10));
  return `${day} ${formatPeriodMonthSv(date, { capitalize: false })}`;
}

export function buildMonthlyResultState(input: {
  now?: Date;
  latestFinalizedPeriodMonth?: string | null;
}): MonthlyResultState {
  const expectedPeriodMonth = expectedResultPeriodMonth(input.now);
  const latest = input.latestFinalizedPeriodMonth
    ? normalizePeriodMonth(input.latestFinalizedPeriodMonth)
    : null;
  const finalized = latest === expectedPeriodMonth;
  return {
    expectedPeriodMonth,
    expectedPeriodLabel: formatPeriodMonthSv(expectedPeriodMonth),
    expectedFinalizationDate: expectedResultFinalizationDate(expectedPeriodMonth),
    expectedFinalizationLabel: formatExpectedFinalizationSv(expectedPeriodMonth),
    latestFinalizedPeriodMonth: latest,
    latestFinalizedPeriodLabel: latest
      ? formatPeriodMonthSv(latest, { includeYear: true })
      : null,
    isExpectedPeriodFinalized: finalized,
    isPending: !finalized,
  };
}

/** Pure reusable MTD aggregation used by tests/UI fallbacks; DB is write-time SoT. */
export function computeMonthToDateSum(
  rows: Array<{ reportDate: string | null; value: string | number | null }>,
  throughDate: string,
): string | null {
  const monthStart = normalizePeriodMonth(throughDate);
  let found = false;
  let sum = 0;
  for (const row of rows) {
    if (
      !row.reportDate ||
      row.reportDate < monthStart ||
      row.reportDate > throughDate
    ) {
      continue;
    }
    const value = parseNumeric(row.value);
    if (value === null) continue;
    found = true;
    sum += value;
  }
  if (!found) return null;
  return String(Math.round(sum * 1000) / 1000).replace(".", ",");
}

export function monthlyResultDisplayName(
  name: string,
  periodMonth: string | null | undefined,
): string {
  return periodMonth
    ? `${name} – ${formatPeriodMonthSv(periodMonth)}`
    : name;
}
