import type { KpiStoredStatus } from "@/lib/kpi/kind";

export type KPIHistory = {
  id: string;
  kpiId: string;
  value: string;
  status: KpiStoredStatus;
  comment: string | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  /** YYYY-MM-DD calendar date for daily reports; null for ordinary/history rows. */
  reportDate: string | null;
  /** Accounting month (YYYY-MM-01), independent of actual submission time. */
  periodMonth: string | null;
  /** Generic monthly economic operands; value remains the computed deviation. */
  actualValue: string | null;
  budgetValue: string | null;
  /** True for preserved deviation-only rows whose operands are unknown. */
  isLegacyDeviation: boolean;
  /** auth.users id; null for automated/system writes. */
  recordedBy: string | null;
};

export type CreateKPIHistoryInput = {
  kpiId: string;
  value: string;
  status: KpiStoredStatus;
  comment?: string;
  recordedAt: string;
  /** Optional; normally resolved from the signed-in user. */
  recordedBy?: string | null;
};

export type UpsertDailyKpiReportInput = {
  kpiId: string;
  /** YYYY-MM-DD (Europe/Stockholm calendar day). */
  reportDate: string;
  value: string;
  status: KpiStoredStatus;
  comment?: string;
  /** Optional; defaults to signed-in user inside the RPC when omitted. */
  recordedBy?: string | null;
};

export type UpsertMonthlyKpiReportInput = {
  kpiId: string;
  /** Accounting/result month, normalized to YYYY-MM-01. */
  periodMonth: string;
  actualValue: string;
  budgetValue: string;
  status: KpiStoredStatus;
  comment?: string;
  recordedBy?: string | null;
};

export type UpsertMonthlyStatisticReportInput = {
  kpiId: string;
  /** Calendar month, normalized to YYYY-MM-01. */
  periodMonth: string;
  value: string;
  comment?: string;
  recordedBy?: string | null;
};
