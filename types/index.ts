export type { StatusTone } from "./status";
export type { BusinessArea } from "./business-area";
export type { Goal, CreateGoalInput } from "./goal";
export type { Activity } from "./activity";
export type { Kpi } from "./kpi";
export type { HistoryEvent } from "./history";

export type BusinessAreaSummary = {
  slug: string;
  name: string;
  manager: string;
  status: import("./status").StatusTone;
  updatedAt: string;
  goalCount: number;
  activityCount: number;
};
