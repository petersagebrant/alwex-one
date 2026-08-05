export type DecisionStatus = "Planerat" | "Pågår" | "Klart";

export type Decision = {
  id: string;
  businessAreaId: string;
  title: string;
  description: string | null;
  owner: string | null;
  meetingDate: string | null;
  dueDate: string | null;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateDecisionInput = {
  businessAreaId: string;
  title: string;
  description?: string;
  owner?: string;
  meetingDate?: string;
  dueDate?: string;
  status: DecisionStatus;
};

export type UpdateDecisionInput = {
  id: string;
  businessAreaId: string;
  title: string;
  description?: string;
  owner?: string;
  meetingDate?: string;
  dueDate?: string;
  status: DecisionStatus;
};
