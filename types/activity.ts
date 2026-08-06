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
  status: ActivityStatus;
  priority: ActivityPriority;
  deadline: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateActivityInput = {
  businessAreaId: string;
  goalId?: string | null;
  title: string;
  description?: string;
  owner?: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  deadline?: string;
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
