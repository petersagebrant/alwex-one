import type { AuthProfile } from "@/lib/auth/require-user";
import {
  fetchKpiHistoryByReportDate,
  fetchKpiHistoryByReportDateForKpis,
  type KpiHistoryRow,
} from "@/lib/supabase/kpi-history";
import { fetchWeightedInputsForParents } from "@/lib/supabase/kpi-calc-weighted-inputs";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { fetchAllKpis } from "@/lib/supabase/kpis";
import { parseKpiCalcOperator } from "@/lib/kpi/calculated";
import {
  isManualReportableKpi,
  isSystemComputedKpi,
  parseKpiKind,
  parseKpiStoredStatus,
} from "@/lib/kpi/kind";
import {
  collectRatioGroupMemberIds,
  countDailyReportingProgress,
  findRatioPercentGroups,
} from "@/lib/kpi/ratioGroup";
import { getKPIsByBusinessArea } from "@/services/kpis";
import {
  getRecentKpiHistoryForKpis,
  toStockholmReportDate,
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
    recordedBy: row.recorded_by ?? null,
  };
}

type ReportingProfile = Pick<AuthProfile, "role" | "businessAreaId">;

function emptyReporting(
  businessAreaId: string,
  businessAreaName: string,
  reportDate = toStockholmReportDate(new Date()),
): MyKpisForTodayReporting {
  return {
    reportDate,
    businessAreaId,
    businessAreaName,
    items: [],
    ratioGroups: [],
    calculatedItems: [],
    reportedCount: 0,
    totalCount: 0,
  };
}

function historyHasValue(
  todayByKpi: Map<string, KPIHistory>,
  kpiId: string | null | undefined,
): boolean {
  if (!kpiId) return false;
  const row = todayByKpi.get(kpiId);
  return Boolean(row?.value?.trim());
}

function toReportItem(
  kpi: KPI,
  reportDate: string,
  todayByKpi: Map<string, KPIHistory>,
  historyByKpi: Map<string, KPIHistory[]>,
  computation?: DailyKpiComputationMeta,
): DailyKpiReportItem {
  const todayReport = todayByKpi.get(kpi.id) ?? null;
  const history = historyByKpi.get(kpi.id) ?? [];
  // Prefer dated daily rows (report_date) for trends; fall back to any prior entry.
  const previousEntry =
    history.find(
      (entry) => entry.reportDate != null && entry.reportDate !== reportDate,
    ) ??
    history.find((entry) => entry.reportDate !== reportDate) ??
    null;

  if (todayReport) {
    return {
      kpi,
      previousValue: previousEntry?.value ?? null,
      previousStatus: previousEntry?.status ?? null,
      todayReport,
      isReported: true,
      computation,
    };
  }

  return {
    kpi,
    previousValue: kpi.currentValue ?? previousEntry?.value ?? null,
    previousStatus: kpi.status ?? previousEntry?.status ?? null,
    todayReport: null,
    isReported: false,
    computation,
  };
}

/**
 * KPIs for a business area with today's reporting state.
 * Unreported first, then reported (name ascending within each group).
 * System-computed KPIs (CALCULATED + TARGET ratio) go in `calculatedItems`.
 * Always returns a reporting object when the area id is valid — never null.
 */
export async function getKpisForTodayReporting(
  businessAreaId: string,
  options?: { businessAreaName?: string },
): Promise<MyKpisForTodayReporting> {
  const reportDate = toStockholmReportDate(new Date());

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

    const reportableKpis = kpis.filter(isManualReportableKpi);
    const calculatedKpis = kpis.filter(isSystemComputedKpi);

    if (reportableKpis.length === 0 && calculatedKpis.length === 0) {
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
    const weightedRows =
      weightedParents.length > 0
        ? await fetchWeightedInputsForParents(
            weightedParents.map((kpi) => kpi.id),
          ).catch(() => [])
        : [];

    for (const row of weightedRows) {
      inputIds.add(row.numerator_kpi_id);
      inputIds.add(row.denominator_kpi_id);
    }

    const kpiIds = [
      ...new Set([
        ...reportableKpis.map((kpi) => kpi.id),
        ...calculatedKpis.map((kpi) => kpi.id),
        ...inputIds,
      ]),
    ];

    const [todayRows, recentHistory] = await Promise.all([
      fetchKpiHistoryByReportDateForKpis(kpiIds, reportDate).catch(() => []),
      getRecentKpiHistoryForKpis(kpiIds, 8).catch(() => []),
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

    const weightedByParent = new Map<string, typeof weightedRows>();
    for (const row of weightedRows) {
      const list = weightedByParent.get(row.parent_kpi_id) ?? [];
      list.push(row);
      weightedByParent.set(row.parent_kpi_id, list);
    }

    const allReportableItems: DailyKpiReportItem[] = reportableKpis.map(
      (kpi) => toReportItem(kpi, reportDate, todayByKpi, historyByKpi),
    );

    allReportableItems.sort((a, b) => {
      if (a.isReported !== b.isReported) {
        return a.isReported ? 1 : -1;
      }
      return a.kpi.name.localeCompare(b.kpi.name, "sv");
    });

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
        }

        return toReportItem(
          kpi,
          reportDate,
          todayByKpi,
          historyByKpi,
          computation,
        );
      })
      .sort((a, b) => a.kpi.name.localeCompare(b.kpi.name, "sv"));

    const groupDefs = findRatioPercentGroups([...reportableKpis, ...calculatedKpis]);
    const reportableById = new Map(
      allReportableItems.map((item) => [item.kpi.id, item]),
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

    const items = allReportableItems.filter(
      (item) => !groupedIds.has(item.kpi.id),
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
): Promise<MyKpisForTodayReporting | null> {
  if (profile.role !== "ao_chef" || !profile.businessAreaId) {
    return null;
  }

  return getKpisForTodayReporting(profile.businessAreaId);
}

/** Org-wide daily reporting progress (for VD / admin Dashboard). */
export async function getTodayOrgReportingStats(): Promise<TodayOrgReportingStats> {
  const reportDate = toStockholmReportDate(new Date());

  try {
    const [kpis, todayRows] = await Promise.all([
      fetchAllKpis(),
      fetchKpiHistoryByReportDate(reportDate),
    ]);

    const reportedIds = new Set(todayRows.map((row) => row.kpi_id));
    const reportable = kpis.filter((kpi) =>
      isManualReportableKpi({
        kind: parseKpiKind(kpi.kpi_kind),
        calcOperator: parseKpiCalcOperator(kpi.calc_operator),
      }),
    );
    const reported = reportable.filter((kpi) => reportedIds.has(kpi.id)).length;

    return {
      reportDate,
      reported,
      total: reportable.length,
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
