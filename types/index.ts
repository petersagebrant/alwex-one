export type { StatusTone } from "./status";
export type { BusinessArea, UpdateBusinessAreaInput } from "./business-area";
export type {
  Goal,
  GoalKind,
  GoalLifecycle,
  CreateGoalInput,
  UpdateGoalInput,
} from "./goal";
export type {
  AreaNotice,
  AreaNoticeKind,
  CreateAreaNoticeInput,
  UpdateAreaNoticeInput,
} from "./area-notice";
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
  KpiCalcOperator,
  KpiReportingFrequency,
  KpiStoredStatus,
  CreateKPIInput,
  UpdateKPIInput,
} from "./kpi";
export type {
  KPIHistory,
  CreateKPIHistoryInput,
  UpsertDailyKpiReportInput,
  UpsertMonthlyKpiReportInput,
  UpsertMonthlyStatisticReportInput,
} from "./kpi-history";
export type {
  DailyKpiComputationMeta,
  DailyKpiReportItem,
  MyKpisForTodayReporting,
  RatioPercentReportGroup,
  TodayOrgReportingStats,
} from "./kpi-reporting";
export type { HistoryEvent } from "./history";
export type { VdDiaryEvent, VdDiaryTone } from "./vd-diary";

export type BusinessAreaSummary = {
  slug: string;
  name: string;
  manager: string;
  /** Display status from reported TARGET KPIs; null = Ej rapporterat. */
  status: import("./status").StatusTone | null;
  updatedAt: string;
  goalCount: number;
  activityCount: number;
};
