import type { ActivityEscalation } from "./activity-escalation";

export type ActivityStatus =
  | "Ej påbörjad"
  | "Pågår"
  | "Klar"
  | "Försenad";

export type ActivityPriority = "Låg" | "Normal" | "Hög";

export type Activity = {
  id: string;
  businessAreaId: string;
  goalId: string | null;
  title: string;
  description: string | null;
  owner: string | null;
  ownerId: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  deadline: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  operationalReportId: string | null;
  sourceKpiId: string | null;
  requiresEscalation: boolean;
  escalatedAt: string | null;
  escalationNote: string | null;
  escalations: ActivityEscalation[];
};

export type CreateActivityInput = {
  businessAreaId: string;
  goalId?: string | null;
  title: string;
  description?: string;
  owner?: string;
  ownerId?: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  deadline?: string;
  operationalReportId?: string | null;
  sourceKpiId?: string | null;
  requiresEscalation?: boolean;
  escalationNote?: string | null;
};

export type UpdateActivityInput = {
  id: string;
  businessAreaId: string;
  goalId?: string | null;
  title: string;
  description?: string;
  owner?: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  deadline?: string;
};
