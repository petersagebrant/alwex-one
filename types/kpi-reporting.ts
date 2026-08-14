import type { KPI } from "./kpi";
import type { KPIHistory } from "./kpi-history";
import type { KpiStoredStatus } from "@/lib/kpi/kind";

export type DailyKpiComputationMeta = {
  /** Both inputs reported for the period (RATIO) or all AO pairs (WEIGHTED). */
  isComplete: boolean;
  /** e.g. "5 av 7 affärsområden rapporterade" for company KPI. */
  completenessLabel: string | null;
};

export type DailyKpiReportItem = {
  kpi: KPI;
  /** Senaste värde före dagens rapport (eller aktuellt om ej rapporterat idag). */
  previousValue: string | null;
  previousStatus: KpiStoredStatus | null;
  todayReport: KPIHistory | null;
  isReported: boolean;
  /** Set for system-computed KPIs (RATIO / WEIGHTED / DIVIDE). */
  computation?: DailyKpiComputationMeta;
};

/**
 * RATIO_PERCENT TARGET + its two STATISTIC inputs, grouped for one report block.
 * Linked via calc_numerator_kpi_id / calc_denominator_kpi_id.
 */
export type RatioPercentReportGroup = {
  result: DailyKpiReportItem;
  numerator: DailyKpiReportItem;
  denominator: DailyKpiReportItem;
};

export type MyKpisForTodayReporting = {
  reportDate: string;
  businessAreaId: string;
  businessAreaName: string;
  /**
   * Manual reportable KPIs not shown in a ratio group.
   * Each item counts as one user-facing reporting point.
   */
  items: DailyKpiReportItem[];
  /**
   * RATIO_PERCENT TARGET + two STATISTIC inputs as one visual block.
   * Each group counts as one reporting point (complete when both inputs are reported).
   */
  ratioGroups: RatioPercentReportGroup[];
  /**
   * System-computed KPIs not already shown in a ratio group
   * (e.g. DIVIDE like Körda mil per RC). Not included in progress counts.
   */
  calculatedItems: DailyKpiReportItem[];
  reportedCount: number;
  totalCount: number;
};

export type TodayOrgReportingStats = {
  reportDate: string;
  reported: number;
  total: number;
};
