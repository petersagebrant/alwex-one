import type { StatusTone } from "./status";

export type KPIHistory = {
  id: string;
  kpiId: string;
  value: string;
  status: StatusTone;
  comment: string | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  /** YYYY-MM-DD calendar date for daily reports; null for ordinary/history rows. */
  reportDate: string | null;
  /** auth.users id; null for automated/system writes. */
  recordedBy: string | null;
};

export type CreateKPIHistoryInput = {
  kpiId: string;
  value: string;
  status: StatusTone;
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
  status: StatusTone;
  comment?: string;
  /** Optional; defaults to signed-in user inside the RPC when omitted. */
  recordedBy?: string | null;
};
