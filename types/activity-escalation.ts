export type ActivityEscalationStatus = "open" | "answered";

export type ActivityEscalation = {
  id: string;
  activityId: string;
  question: string;
  askedBy: string | null;
  askedByName: string;
  askedAt: string;
  reply: string | null;
  repliedBy: string | null;
  repliedByName: string | null;
  repliedAt: string | null;
  status: ActivityEscalationStatus;
};

export type LeadershipEscalationItem = {
  id: string;
  activityId: string;
  activityTitle: string;
  activityStatus: string;
  businessAreaName: string;
  askedByName: string;
  question: string;
  askedAt: string;
};
