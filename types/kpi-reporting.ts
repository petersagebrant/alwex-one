import type { KPI } from "./kpi";
import type { KPIHistory } from "./kpi-history";
import type { StatusTone } from "./status";

export type DailyKpiReportItem = {
  kpi: KPI;
  /** Senaste värde före dagens rapport (eller aktuellt om ej rapporterat idag). */
  previousValue: string | null;
  previousStatus: StatusTone | null;
  todayReport: KPIHistory | null;
  isReported: boolean;
};

export type MyKpisForTodayReporting = {
  reportDate: string;
  businessAreaId: string;
  businessAreaName: string;
  items: DailyKpiReportItem[];
  reportedCount: number;
  totalCount: number;
};

export type TodayOrgReportingStats = {
  reportDate: string;
  reported: number;
  total: number;
};
