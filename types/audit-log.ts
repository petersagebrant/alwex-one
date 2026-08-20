export type AuditFieldChange = {
  field: string;
  from: string | null;
  to: string | null;
};

export type AuditChangesPayload = {
  fields: AuditFieldChange[];
};

export type AuditLogEntry = {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  description: string;
  actorName: string;
  businessAreaId: string | null;
  createdAt: string;
  /** Structured from/to field changes when available. */
  changes: AuditChangesPayload | null;
};

export type CreateAuditLogInput = {
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  actorName: string;
  businessAreaId?: string | null;
  changes?: AuditChangesPayload | null;
};
