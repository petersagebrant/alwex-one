import {
  countTargetKpiStatuses,
  effectiveTargetStatusTone,
  hasValidKpiCurrentValue,
} from "@/lib/kpi/kind";
import { countKpiSetReportingProgress } from "@/lib/kpi/reportingProgress";
import { resolveKpiTrend } from "@/lib/kpi/resolveTrend";
import { selectKeyKpis } from "@/lib/kpi/selectKeyKpis";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import {
  fetchKpiHistoryByReportDate,
} from "@/lib/supabase/kpi-history";
import { getKPIs, type KPIListItem } from "@/services/kpis";
import { getRecentKpiHistoryForKpis } from "@/services/kpiHistory";
import {
  compareHistoryByCalendarDate,
  resolveDailyReportDate,
} from "@/lib/kpi/dailyReportDate";
import type { KPI, KpiTrend } from "@/types/kpi";
import type { KPIHistory } from "@/types/kpi-history";
import type { StatusTone } from "@/types/status";

export type KpiOverviewDisplayItem = {
  kpi: KPI & { businessAreaName?: string };
  displayTrend: KpiTrend;
  previousValue: string | null;
  lastReportedAt: string | null;
  href: string;
};

export type KpiOverviewAreaSection = {
  areaId: string;
  areaName: string;
  areaSlug: string;
  isAlwexTotalt: boolean;
  statusCounts: Record<StatusTone, number>;
  keyKpis: KpiOverviewDisplayItem[];
  reporting: {
    reportedCount: number;
    totalCount: number;
    unreportedCount: number;
  };
  /** All active KPIs for the area (TARGET + STATISTIC + CALCULATED). */
  allKpis: KpiOverviewDisplayItem[];
};

export type KpiOverviewData = {
  reportDate: string;
  orgStatusCounts: Record<StatusTone, number>;
  alwexTotalt: KpiOverviewAreaSection | null;
  areas: KpiOverviewAreaSection[];
};

function isAlwexTotaltArea(area: { name: string; slug: string }): boolean {
  const slug = area.slug.trim().toLowerCase();
  const name = area.name.trim().toLowerCase();
  return slug === "alwex-totalt" || name === "alwex totalt";
}

function historyNewestFirst(entries: KPIHistory[]): KPIHistory[] {
  return [...entries].sort((a, b) => compareHistoryByCalendarDate(b, a));
}

export function enrichKpiForDisplay(
  kpi: KPI & { businessAreaName?: string },
  history: KPIHistory[],
): KpiOverviewDisplayItem {
  const sorted = historyNewestFirst(history);
  const previous = sorted[1] ?? null;
  const latest = sorted[0] ?? null;

  return {
    kpi,
    displayTrend: resolveKpiTrend(kpi.trend, sorted),
    previousValue: previous?.value ?? null,
    lastReportedAt: latest?.updatedAt ?? latest?.createdAt ?? latest?.recordedAt ?? null,
    href: `/kpis/${kpi.id}`,
  };
}

function buildAreaSection(input: {
  areaId: string;
  areaName: string;
  areaSlug: string;
  isAlwexTotalt: boolean;
  kpis: KPIListItem[];
  historyByKpi: Map<string, KPIHistory[]>;
  reportedIds: ReadonlySet<string>;
}): KpiOverviewAreaSection {
  const allKpis = input.kpis
    .map((kpi) =>
      enrichKpiForDisplay(kpi, input.historyByKpi.get(kpi.id) ?? []),
    )
    .sort((a, b) => a.kpi.name.localeCompare(b.kpi.name, "sv"));

  const keyKpis = selectKeyKpis(input.kpis).map((kpi) => {
    const enriched = allKpis.find((row) => row.kpi.id === kpi.id);
    return (
      enriched ??
      enrichKpiForDisplay(kpi, input.historyByKpi.get(kpi.id) ?? [])
    );
  });

  const statusCounts = countTargetKpiStatuses(input.kpis);
  const reporting = countKpiSetReportingProgress(input.kpis, input.reportedIds);

  return {
    areaId: input.areaId,
    areaName: input.areaName,
    areaSlug: input.areaSlug,
    isAlwexTotalt: input.isAlwexTotalt,
    statusCounts,
    keyKpis,
    reporting: {
      reportedCount: reporting.reportedCount,
      totalCount: reporting.totalCount,
      unreportedCount: Math.max(
        0,
        reporting.totalCount - reporting.reportedCount,
      ),
    },
    allKpis,
  };
}

/**
 * VD KPI-översikt: Alwex totalt first, then AO sections with key KPIs,
 * TARGET-only G/Y/R counts, and reporting progress (ratio groups as one).
 */
export async function getKpiOverviewData(): Promise<KpiOverviewData> {
  const reportDate = resolveDailyReportDate(undefined);

  try {
    const [kpis, areas, todayRows] = await Promise.all([
      getKPIs().catch(() => [] as KPIListItem[]),
      fetchBusinessAreas().catch(() => []),
      fetchKpiHistoryByReportDate(reportDate).catch(() => []),
    ]);

    const reportedIds = new Set(
      todayRows
        .filter((row) => hasValidKpiCurrentValue(row.value))
        .map((row) => row.kpi_id),
    );
    const history =
      kpis.length > 0
        ? await getRecentKpiHistoryForKpis(
            kpis.map((kpi) => kpi.id),
            8,
          ).catch(() => [] as KPIHistory[])
        : [];

    const historyByKpi = new Map<string, KPIHistory[]>();
    for (const entry of history) {
      const list = historyByKpi.get(entry.kpiId) ?? [];
      list.push(entry);
      historyByKpi.set(entry.kpiId, list);
    }

    const areaById = new Map(areas.map((area) => [area.id, area]));
    const kpisByArea = new Map<string, KPIListItem[]>();
    for (const kpi of kpis) {
      const list = kpisByArea.get(kpi.businessAreaId) ?? [];
      list.push(kpi);
      kpisByArea.set(kpi.businessAreaId, list);
    }

    const sections: KpiOverviewAreaSection[] = [];

    // Always include every business area (incl. Alwex totalt), even with 0 KPIs.
    for (const area of areas) {
      const areaKpis = kpisByArea.get(area.id) ?? [];
      sections.push(
        buildAreaSection({
          areaId: area.id,
          areaName: area.name,
          areaSlug: area.slug,
          isAlwexTotalt: isAlwexTotaltArea(area),
          kpis: areaKpis,
          historyByKpi,
          reportedIds,
        }),
      );
    }

    // KPIs whose area row is missing still need a section.
    for (const [areaId, areaKpis] of kpisByArea) {
      if (sections.some((section) => section.areaId === areaId)) {
        continue;
      }
      const fallbackName = areaKpis[0]?.businessAreaName ?? "Okänt område";
      const area = areaById.get(areaId);
      sections.push(
        buildAreaSection({
          areaId,
          areaName: area?.name ?? fallbackName,
          areaSlug: area?.slug ?? areaId,
          isAlwexTotalt: area ? isAlwexTotaltArea(area) : false,
          kpis: areaKpis,
          historyByKpi,
          reportedIds,
        }),
      );
    }

    const alwexTotalt =
      sections.find((section) => section.isAlwexTotalt) ?? null;
    const otherAreas = sections
      .filter((section) => !section.isAlwexTotalt)
      .sort((a, b) => a.areaName.localeCompare(b.areaName, "sv"));

    const orgStatusCounts = countTargetKpiStatuses(kpis);

    return {
      reportDate,
      orgStatusCounts,
      alwexTotalt,
      areas: otherAreas,
    };
  } catch {
    return {
      reportDate,
      orgStatusCounts: { Grön: 0, Gul: 0, Röd: 0 },
      alwexTotalt: null,
      areas: [],
    };
  }
}

/** Enrich KPIs for AO detail / list views (trend, previous, last report). */
export async function enrichKpisForAreaDisplay(
  kpis: Array<KPI & { businessAreaName?: string }>,
): Promise<KpiOverviewDisplayItem[]> {
  if (kpis.length === 0) {
    return [];
  }

  const history = await getRecentKpiHistoryForKpis(
    kpis.map((kpi) => kpi.id),
    8,
  ).catch(() => [] as KPIHistory[]);

  const historyByKpi = new Map<string, KPIHistory[]>();
  for (const entry of history) {
    const list = historyByKpi.get(entry.kpiId) ?? [];
    list.push(entry);
    historyByKpi.set(entry.kpiId, list);
  }

  return kpis
    .map((kpi) => enrichKpiForDisplay(kpi, historyByKpi.get(kpi.id) ?? []))
    .sort((a, b) => {
      // TARGET with effective G/Y/R first (Röd→Gul→Grön); unreported TARGET after;
      // then STATISTIC/CALCULATED
      const aTone = effectiveTargetStatusTone(a.kpi);
      const bTone = effectiveTargetStatusTone(b.kpi);
      const aRanked = aTone != null;
      const bRanked = bTone != null;
      if (aRanked !== bRanked) {
        return aRanked ? -1 : 1;
      }
      if (aTone && bTone) {
        const rank = { Röd: 0, Gul: 1, Grön: 2 } as const;
        const diff = rank[aTone] - rank[bTone];
        if (diff !== 0) return diff;
      }
      return a.kpi.name.localeCompare(b.kpi.name, "sv");
    });
}
