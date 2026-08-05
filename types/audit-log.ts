export type AuditLogEntry = {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  description: string;
  actorName: string;
  businessAreaId: string | null;
  createdAt: string;
};

export type CreateAuditLogInput = {
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  actorName: string;
  businessAreaId?: string | null;
};
