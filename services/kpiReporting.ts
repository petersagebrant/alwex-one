import type { AuthProfile } from "@/lib/auth/require-user";
import {
  fetchKpiHistoryByReportDate,
  fetchKpiHistoryByReportDateForKpis,
  fetchKpiHistoryByPeriodMonthsForKpis,
  type KpiHistoryRow,
} from "@/lib/supabase/kpi-history";
import { fetchWeightedInputsForParents } from "@/lib/supabase/kpi-calc-weighted-inputs";
import { fetchSumNumeratorsForParents } from "@/lib/supabase/kpi-calc-sum-numerators";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { fetchAllKpis } from "@/lib/supabase/kpis";
import { parseKpiCalcOperator } from "@/lib/kpi/calculated";
import { expectedResultPeriodMonth } from "@/lib/kpi/economics";
import {
  hasValidKpiCurrentValue,
  isSystemComputedKpi,
  parseKpiKind,
  parseKpiRatioReportingMode,
  parseKpiReportingFrequency,
  parseKpiStoredStatus,
} from "@/lib/kpi/kind";
import { toMonthlyReportItem, splitManualReportableKpis } from "@/lib/kpi/monthlyReporting";
import {
  collectRatioGroupMemberIds,
  countDailyReportingProgress,
  findRatioPercentGroups,
} from "@/lib/kpi/ratioGroup";
import { countKpiSetReportingProgress } from "@/lib/kpi/reportingProgress";
import { getKPIsByBusinessArea } from "@/services/kpis";
import { resolveDailyReportDate } from "@/lib/kpi/dailyReportDate";
import { selectPreviousDailyHistoryEntry } from "@/lib/kpi/dailyKpiReport";
import {
  getPreviousKpiHistoryBeforeDateForKpis,
  getRecentKpiHistoryForKpis,
} from "@/services/kpiHistory";
import type {
  DailyKpiComputationMeta,
  DailyKpiReportItem,
  KPI,
  KPIHistory,
  MyKpisForTodayReporting,
  RatioPercentReportGroup,
  TodayOrgReportingStats,
} from "@/types";

export type {
  DailyKpiReportItem,
  MyKpisForTodayReporting,
  TodayOrgReportingStats,
} from "@/types";

function mapHistoryRow(row: KpiHistoryRow): KPIHistory {
  return {
    id: row.id,
    kpiId: row.kpi_id,
    value: row.value,
    status: parseKpiStoredStatus(row.status),
    comment: row.comment,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    reportDate: row.report_date ?? null,
    periodMonth: row.period_month ?? null,
    actualValue: row.actual_value ?? null,
    budgetValue: row.budget_value ?? null,
    isLegacyDeviation:
      row.period_month != null &&
      row.actual_value == null &&
      row.budget_value == null,
    recordedBy: row.recorded_by ?? null,
  };
}

type ReportingProfile = Pick<AuthProfile, "role" | "businessAreaId">;

function emptyReporting(
  businessAreaId: string,
  businessAreaName: string,
  reportDate = resolveDailyReportDate(undefined),
): MyKpisForTodayReporting {
  return {
    reportDate,
    businessAreaId,
    businessAreaName,
    items: [],
    ratioGroups: [],
    monthlyItems: [],
    calculatedItems: [],
    reportedCount: 0,
    totalCount: 0,
  };
}

/** Same SoT as item.isReported: today's history row has a parseable numeric value. */
function historyHasValue(
  todayByKpi: Map<string, KPIHistory>,
  kpiId: string | null | undefined,
): boolean {
  if (!kpiId) return false;
  const row = todayByKpi.get(kpiId);
  return hasValidKpiCurrentValue(row?.value);
}

function toReportItem(
  kpi: KPI,
  reportDate: string,
  todayByKpi: Map<string, KPIHistory>,
  previousByKpi: Map<string, KPIHistory>,
  historyByKpi: Map<string, KPIHistory[]>,
  computation?: DailyKpiComputationMeta,
): DailyKpiReportItem {
  const todayReport = todayByKpi.get(kpi.id) ?? null;
  const previousEntry =
    previousByKpi.get(kpi.id) ??
    selectPreviousDailyHistoryEntry(historyByKpi.get(kpi.id) ?? [], reportDate);

  // Single SoT for badge + progress: valid numeric value on today's report_date row.
  const isReported = hasValidKpiCurrentValue(todayReport?.value);

  return {
    kpi,
    previousValue: previousEntry?.value ?? null,
    previousStatus: previousEntry?.status ?? null,
    todayReport: isReported ? todayReport : null,
    isReported,
    computation,
  };
}

function sortReportItems(items: DailyKpiReportItem[]): DailyKpiReportItem[] {
  return [...items].sort((a, b) => {
    if (a.isReported !== b.isReported) {
      return a.isReported ? 1 : -1;
    }
    return a.kpi.name.localeCompare(b.kpi.name, "sv");
  });
}

/**
 * KPIs for a business area with today's reporting state.
 * Unreported first, then reported (name ascending within each group).
 * System-computed KPIs (CALCULATED + TARGET ratio) go in `calculatedItems`.
 * MONTHLY manual KPIs go in `monthlyItems` (excluded from daily progress).
 * Always returns a reporting object when the area id is valid — never null.
 */
export async function getKpisForTodayReporting(
  businessAreaId: string,
  options?: { businessAreaName?: string; reportDate?: string },
): Promise<MyKpisForTodayReporting> {
  const reportDate = resolveDailyReportDate(options?.reportDate);

  try {
    const [kpis, areas] = await Promise.all([
      getKPIsByBusinessArea(businessAreaId),
      fetchBusinessAreas().catch(() => []),
    ]);

    const businessAreaName =
      options?.businessAreaName ??
      areas.find((area) => area.id === businessAreaId)?.name ??
      "Affärsområde";

    if (kpis.length === 0) {
      return emptyReporting(businessAreaId, businessAreaName, reportDate);
    }

    const { daily: dailyReportableKpis, monthly: monthlyReportableKpis } =
      splitManualReportableKpis(kpis);
    const reportableKpis = [...dailyReportableKpis, ...monthlyReportableKpis];
    const calculatedKpis = kpis.filter(isSystemComputedKpi);

    if (
      reportableKpis.length === 0 &&
      calculatedKpis.length === 0
    ) {
      return emptyReporting(businessAreaId, businessAreaName, reportDate);
    }

    const inputIds = new Set<string>();
    for (const kpi of calculatedKpis) {
      if (kpi.calcNumeratorKpiId) inputIds.add(kpi.calcNumeratorKpiId);
      if (kpi.calcDenominatorKpiId) inputIds.add(kpi.calcDenominatorKpiId);
    }

    const weightedParents = calculatedKpis.filter(
      (kpi) => kpi.calcOperator === "WEIGHTED_RATIO_PERCENT",
    );
    const sumDivideParents = calculatedKpis.filter(
      (kpi) => kpi.calcOperator === "SUM_DIVIDE",
    );

    const [weightedRows, sumNumeratorRows] = await Promise.all([
      weightedParents.length > 0
        ? fetchWeightedInputsForParents(
            weightedParents.map((kpi) => kpi.id),
          ).catch(() => [])
        : Promise.resolve([]),
      sumDivideParents.length > 0
        ? fetchSumNumeratorsForParents(
            sumDivideParents.map((kpi) => kpi.id),
          ).catch(() => [])
        : Promise.resolve([]),
    ]);

    for (const row of weightedRows) {
      inputIds.add(row.numerator_kpi_id);
      inputIds.add(row.denominator_kpi_id);
    }
    for (const row of sumNumeratorRows) {
      inputIds.add(row.numerator_kpi_id);
    }

    const kpiIds = [
      ...new Set([
        ...reportableKpis.map((kpi) => kpi.id),
        ...calculatedKpis.map((kpi) => kpi.id),
        ...inputIds,
      ]),
    ];

    const monthlyKpiIds = monthlyReportableKpis.map((kpi) => kpi.id);
    const resultPeriodMonth = expectedResultPeriodMonth();

    const [todayRows, recentHistory, monthRows, previousRows] = await Promise.all([
      fetchKpiHistoryByReportDateForKpis(kpiIds, reportDate).catch(() => []),
      getRecentKpiHistoryForKpis(kpiIds, 8).catch(() => []),
      monthlyKpiIds.length > 0
        ? fetchKpiHistoryByPeriodMonthsForKpis(
            monthlyKpiIds,
            [resultPeriodMonth],
          ).catch(() => [])
        : Promise.resolve([]),
      getPreviousKpiHistoryBeforeDateForKpis(kpiIds, reportDate).catch(() => []),
    ]);

    const todayByKpi = new Map(
      todayRows.map((row) => [row.kpi_id, mapHistoryRow(row)]),
    );

    const historyByKpi = new Map<string, KPIHistory[]>();
    for (const entry of recentHistory) {
      const list = historyByKpi.get(entry.kpiId) ?? [];
      list.push(entry);
      historyByKpi.set(entry.kpiId, list);
    }

    const previousByKpi = new Map(
      previousRows.map((entry) => [entry.kpiId, entry]),
    );

    // Newest row per monthly KPI (query ordered by report_date desc).
    const monthByKpi = new Map<string, KPIHistory>();
    for (const row of monthRows) {
      if (monthByKpi.has(row.kpi_id)) continue;
      monthByKpi.set(row.kpi_id, mapHistoryRow(row));
    }

    const weightedByParent = new Map<string, typeof weightedRows>();
    for (const row of weightedRows) {
      const list = weightedByParent.get(row.parent_kpi_id) ?? [];
      list.push(row);
      weightedByParent.set(row.parent_kpi_id, list);
    }

    const sumNumeratorsByParent = new Map<string, typeof sumNumeratorRows>();
    for (const row of sumNumeratorRows) {
      const list = sumNumeratorsByParent.get(row.parent_kpi_id) ?? [];
      list.push(row);
      sumNumeratorsByParent.set(row.parent_kpi_id, list);
    }

    const allDailyReportableItems: DailyKpiReportItem[] = dailyReportableKpis.map(
      (kpi) =>
        toReportItem(kpi, reportDate, todayByKpi, previousByKpi, historyByKpi),
    );

    const monthlyItems = sortReportItems(
      monthlyReportableKpis.map((kpi) =>
        toMonthlyReportItem(kpi, resultPeriodMonth, monthByKpi, historyByKpi),
      ),
    );

    const allCalculatedItems: DailyKpiReportItem[] = calculatedKpis
      .map((kpi) => {
        let computation: DailyKpiComputationMeta | undefined;

        if (kpi.calcOperator === "RATIO_PERCENT") {
          const complete =
            historyHasValue(todayByKpi, kpi.calcNumeratorKpiId) &&
            historyHasValue(todayByKpi, kpi.calcDenominatorKpiId);
          computation = {
            isComplete: complete,
            completenessLabel: null,
          };
        } else if (kpi.calcOperator === "WEIGHTED_RATIO_PERCENT") {
          const parts = weightedByParent.get(kpi.id) ?? [];
          let reported = 0;
          for (const part of parts) {
            if (
              historyHasValue(todayByKpi, part.numerator_kpi_id) &&
              historyHasValue(todayByKpi, part.denominator_kpi_id)
            ) {
              reported += 1;
            }
          }
          const total = parts.length;
          computation = {
            isComplete: total > 0 && reported === total,
            completenessLabel: `${reported} av ${total} affärsområden rapporterade`,
          };
        } else if (kpi.calcOperator === "DIVIDE") {
          const complete =
            historyHasValue(todayByKpi, kpi.calcNumeratorKpiId) &&
            historyHasValue(todayByKpi, kpi.calcDenominatorKpiId);
          computation = {
            isComplete: complete,
            completenessLabel: null,
          };
        } else if (kpi.calcOperator === "SUM_DIVIDE") {
          const nums = sumNumeratorsByParent.get(kpi.id) ?? [];
          const allNums =
            nums.length > 0 &&
            nums.every((row) =>
              historyHasValue(todayByKpi, row.numerator_kpi_id),
            );
          const complete =
            allNums && historyHasValue(todayByKpi, kpi.calcDenominatorKpiId);
          computation = {
            isComplete: complete,
            completenessLabel: null,
          };
        }

        return toReportItem(
          kpi,
          reportDate,
          todayByKpi,
          previousByKpi,
          historyByKpi,
          computation,
        );
      })
      .sort((a, b) => a.kpi.name.localeCompare(b.kpi.name, "sv"));

    const groupDefs = findRatioPercentGroups([
      ...dailyReportableKpis,
      ...calculatedKpis,
    ]);
    const reportableById = new Map(
      allDailyReportableItems.map((item) => [item.kpi.id, item]),
    );
    const calculatedById = new Map(
      allCalculatedItems.map((item) => [item.kpi.id, item]),
    );

    const ratioGroups: RatioPercentReportGroup[] = [];
    for (const def of groupDefs) {
      const result = calculatedById.get(def.resultKpiId);
      const numerator = reportableById.get(def.numeratorKpiId);
      const denominator = reportableById.get(def.denominatorKpiId);
      if (!result || !numerator || !denominator) {
        continue;
      }
      ratioGroups.push({ result, numerator, denominator });
    }

    const groupedIds = collectRatioGroupMemberIds(
      ratioGroups.map((group) => ({
        resultKpiId: group.result.kpi.id,
        numeratorKpiId: group.numerator.kpi.id,
        denominatorKpiId: group.denominator.kpi.id,
      })),
    );

    const items = sortReportItems(
      allDailyReportableItems.filter((item) => !groupedIds.has(item.kpi.id)),
    );
    const calculatedItems = allCalculatedItems.filter(
      (item) => !groupedIds.has(item.kpi.id),
    );

    const { reportedCount, totalCount } = countDailyReportingProgress({
      items,
      ratioGroups,
    });

    return {
      reportDate,
      businessAreaId,
      businessAreaName,
      items,
      ratioGroups,
      monthlyItems,
      calculatedItems,
      reportedCount,
      totalCount,
    };
  } catch {
    return emptyReporting(
      businessAreaId,
      options?.businessAreaName ?? "Affärsområde",
      reportDate,
    );
  }
}

/**
 * AO-chef: KPIs for their business_area_id with today's reporting state.
 */
export async function getMyKpisForTodayReporting(
  profile: ReportingProfile,
  reportDate?: string,
): Promise<MyKpisForTodayReporting | null> {
  if (profile.role !== "ao_chef" || !profile.businessAreaId) {
    return null;
  }

  return getKpisForTodayReporting(profile.businessAreaId, { reportDate });
}

/** Org-wide daily reporting progress (default: Stockholm yesterday). */
export async function getTodayOrgReportingStats(
  reportDateInput?: string,
): Promise<TodayOrgReportingStats> {
  const reportDate = resolveDailyReportDate(reportDateInput);

  try {
    const [kpis, todayRows] = await Promise.all([
      fetchAllKpis(),
      fetchKpiHistoryByReportDate(reportDate),
    ]);

    const reportedIds = new Set(
      todayRows
        .filter((row) => hasValidKpiCurrentValue(row.value))
        .map((row) => row.kpi_id),
    );
    const progressKpis = kpis.map((kpi) => ({
      id: kpi.id,
      kind: parseKpiKind(kpi.kpi_kind),
      calcOperator: parseKpiCalcOperator(kpi.calc_operator),
      calcNumeratorKpiId: kpi.calc_numerator_kpi_id,
      calcDenominatorKpiId: kpi.calc_denominator_kpi_id,
      ratioReportingMode: parseKpiRatioReportingMode(kpi.ratio_reporting_mode),
      reportingFrequency: parseKpiReportingFrequency(kpi.reporting_frequency),
    }));
    const { reportedCount, totalCount } = countKpiSetReportingProgress(
      progressKpis,
      reportedIds,
    );

    return {
      reportDate,
      reported: reportedCount,
      total: totalCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("kpi_history") ||
      message.includes("kpis") ||
      message.includes("schema cache")
    ) {
      return { reportDate, reported: 0, total: 0 };
    }
    throw error;
  }
}

/** Soft helper for Dashboard role branching without redirect. */
export async function getDashboardReportingContext(
  profile: ReportingProfile,
): Promise<{
  kind: "ao_chef" | "leadership" | "none";
  myReporting: MyKpisForTodayReporting | null;
  orgStats: TodayOrgReportingStats | null;
}> {
  if (profile.role === "ao_chef" && profile.businessAreaId) {
    const myReporting = await getMyKpisForTodayReporting(profile);
    return { kind: "ao_chef", myReporting, orgStats: null };
  }

  if (profile.role === "vd" || profile.role === "administrator") {
    const orgStats = await getTodayOrgReportingStats();
    return { kind: "leadership", myReporting: null, orgStats };
  }

  return { kind: "none", myReporting: null, orgStats: null };
}
