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
export type { AuditLogEntry, CreateAuditLogInput, AuditFieldChange, AuditChangesPayload } from "./audit-log";
export type {
  KPI,
  Kpi,
  KpiTrend,
  KpiDirection,
  KpiToleranceType,
  KpiKind,
  KpiStoredStatus,
  CreateKPIInput,
  UpdateKPIInput,
} from "./kpi";
export type {
  KPIHistory,
  CreateKPIHistoryInput,
  UpsertDailyKpiReportInput,
} from "./kpi-history";
export type {
  DailyKpiReportItem,
  MyKpisForTodayReporting,
  TodayOrgReportingStats,
} from "./kpi-reporting";
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
