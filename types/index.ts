export type { StatusTone } from "./status";
export type { BusinessArea, UpdateBusinessAreaInput } from "./business-area";
export type { Goal, CreateGoalInput, UpdateGoalInput } from "./goal";
export type {
  Activity,
  ActivityStatus,
  ActivityPriority,
  CreateActivityInput,
  UpdateActivityInput,
} from "./activity";
export type {
  ActivityComment,
  CreateActivityCommentInput,
} from "./activity-comment";
export type {
  Decision,
  DecisionStatus,
  CreateDecisionInput,
  UpdateDecisionInput,
} from "./decision";
export type { AuditLogEntry, CreateAuditLogInput } from "./audit-log";
export type {
  KPI,
  Kpi,
  KpiTrend,
  CreateKPIInput,
  UpdateKPIInput,
} from "./kpi";
export type {
  KPIHistory,
  CreateKPIHistoryInput,
} from "./kpi-history";
export type { HistoryEvent } from "./history";
export type { VdDiaryEvent, VdDiaryTone } from "./vd-diary";

export type BusinessAreaSummary = {
  slug: string;
  name: string;
  manager: string;
  status: import("./status").StatusTone;
  updatedAt: string;
  goalCount: number;
  activityCount: number;
};
