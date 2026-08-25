import type { StatusTone } from "./status";

export type GoalKind = "MEASURABLE" | "ACTIVITY";
export type GoalLifecycle = "ACTIVE" | "DONE";

export type Goal = {
  id: string;
  businessAreaId: string;
  title: string;
  description: string | null;
  owner: string | null;
  ownerId: string | null;
  goalKind: GoalKind;
  lifecycle: GoalLifecycle;
  status: StatusTone;
  targetValue: string | null;
  currentValue: string | null;
  deadline: string | null;
  progress: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateGoalInput = {
  businessAreaId: string;
  title: string;
  description?: string;
  ownerId?: string;
  owner?: string;
  goalKind: GoalKind;
  lifecycle?: GoalLifecycle;
  status?: StatusTone;
  targetValue?: string;
  currentValue?: string;
  deadline?: string;
};

export type UpdateGoalInput = {
  id: string;
  businessAreaId: string;
  title: string;
  description?: string;
  ownerId?: string;
  owner?: string;
  goalKind: GoalKind;
  lifecycle?: GoalLifecycle;
  status?: StatusTone;
  targetValue?: string;
  currentValue?: string;
  deadline?: string;
};
