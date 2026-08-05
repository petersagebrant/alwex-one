import type { StatusTone } from "./status";

export type Goal = {
  id: string;
  businessAreaId: string;
  title: string;
  description: string | null;
  owner: string | null;
  status: StatusTone;
  targetValue: string | null;
  currentValue: string | null;
  deadline: string | null;
  progress: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateGoalInput = {
  businessAreaId: string;
  title: string;
  description?: string;
  owner?: string;
  status: StatusTone;
  targetValue?: string;
  currentValue?: string;
  deadline?: string;
  progress?: number;
};
