import type { StatusTone } from "./status";

export type KPIHistory = {
  id: string;
  kpiId: string;
  value: string;
  status: StatusTone;
  comment: string | null;
  recordedAt: string;
  createdAt: string;
};

export type CreateKPIHistoryInput = {
  kpiId: string;
  value: string;
  status: StatusTone;
  comment?: string;
  recordedAt: string;
};
