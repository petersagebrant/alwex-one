import type { AuthProfile } from "@/lib/auth/require-user";
import {
  fetchKpiHistoryByReportDate,
  fetchKpiHistoryByReportDateForKpis,
  type KpiHistoryRow,
} from "@/lib/supabase/kpi-history";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { fetchAllKpis } from "@/lib/supabase/kpis";
import { getKPIsByBusinessArea } from "@/services/kpis";
import {
  getRecentKpiHistoryForKpis,
  toStockholmReportDate,
} from "@/services/kpiHistory";
import { parseKpiStoredStatus } from "@/lib/kpi/kind";
import type {
  DailyKpiReportItem,
  KPIHistory,
  MyKpisForTodayReporting,
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
    reportedCount: 0,
    totalCount: 0,
  };
}

/**
 * KPIs for a business area with today's reporting state.
 * Unreported first, then reported (name ascending within each group).
 * Always returns a reporting object when the area id is valid — never null.
 * Empty/error → `{ items: [], reportedCount: 0, totalCount: 0, ... }`.
 * Callers must enforce role/area authorization before invoking.
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

    const kpiIds = kpis.map((kpi) => kpi.id);
    const [todayRows, recentHistory] = await Promise.all([
      fetchKpiHistoryByReportDateForKpis(kpiIds, reportDate).catch(() => []),
      // Enough rows to skip today and still find a prior daily report_date.
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

    const items: DailyKpiReportItem[] = kpis.map((kpi) => {
      const todayReport = todayByKpi.get(kpi.id) ?? null;
      const history = historyByKpi.get(kpi.id) ?? [];
      // Prefer dated daily rows (report_date) for trends; fall back to any prior entry.
      const previousEntry =
        history.find(
          (entry) =>
            entry.reportDate != null && entry.reportDate !== reportDate,
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
        };
      }

      return {
        kpi,
        previousValue: kpi.currentValue ?? previousEntry?.value ?? null,
        previousStatus: kpi.status ?? previousEntry?.status ?? null,
        todayReport: null,
        isReported: false,
      };
    });

    items.sort((a, b) => {
      if (a.isReported !== b.isReported) {
        return a.isReported ? 1 : -1;
      }
      return a.kpi.name.localeCompare(b.kpi.name, "sv");
    });

    const reportedCount = items.filter((item) => item.isReported).length;

    return {
      reportDate,
      businessAreaId,
      businessAreaName,
      items,
      reportedCount,
      totalCount: items.length,
    };
  } catch {
    // Area is valid at the call site — never collapse to null / choose-area UI.
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
    const reported = kpis.filter((kpi) => reportedIds.has(kpi.id)).length;

    return {
      reportDate,
      reported,
      total: kpis.length,
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
