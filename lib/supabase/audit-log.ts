import { createClient } from "@/lib/supabase/server";

export type AuditLogRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string;
  actor_name: string;
  business_area_id: string | null;
  created_at: string;
  changes: unknown | null;
};

export type InsertAuditLogInput = {
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string;
  actor_name: string;
  business_area_id: string | null;
  changes?: unknown | null;
};

const auditSelect =
  "id, entity_type, entity_id, action, description, actor_name, business_area_id, created_at, changes";

const auditSelectLegacy =
  "id, entity_type, entity_id, action, description, actor_name, business_area_id, created_at";

function isMissingChangesColumn(message: string): boolean {
  return (
    message.includes("changes") &&
    (message.includes("column") ||
      message.includes("schema cache") ||
      message.includes("Could not find"))
  );
}

export async function fetchRecentAuditLog(
  limit = 10,
): Promise<AuditLogRow[]> {
  const supabase = await createClient();

  const primary = await supabase
    .from("audit_log")
    .select(auditSelect)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!primary.error) {
    return (primary.data ?? []) as AuditLogRow[];
  }

  if (!isMissingChangesColumn(primary.error.message)) {
    throw new Error(`Kunde inte hämta audit_log: ${primary.error.message}`);
  }

  const fallback = await supabase
    .from("audit_log")
    .select(auditSelectLegacy)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fallback.error) {
    throw new Error(`Kunde inte hämta audit_log: ${fallback.error.message}`);
  }

  return (fallback.data ?? []).map((row) => ({
    ...row,
    changes: null,
  })) as AuditLogRow[];
}

export async function fetchAuditLogByBusinessAreaId(
  businessAreaId: string,
  limit = 50,
): Promise<AuditLogRow[]> {
  const supabase = await createClient();

  const primary = await supabase
    .from("audit_log")
    .select(auditSelect)
    .eq("business_area_id", businessAreaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!primary.error) {
    return (primary.data ?? []) as AuditLogRow[];
  }

  if (!isMissingChangesColumn(primary.error.message)) {
    throw new Error(`Kunde inte hämta audit_log: ${primary.error.message}`);
  }

  const fallback = await supabase
    .from("audit_log")
    .select(auditSelectLegacy)
    .eq("business_area_id", businessAreaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fallback.error) {
    throw new Error(`Kunde inte hämta audit_log: ${fallback.error.message}`);
  }

  return (fallback.data ?? []).map((row) => ({
    ...row,
    changes: null,
  })) as AuditLogRow[];
}

export async function fetchAuditLogSince(
  cutoffIso: string,
  limit = 150,
): Promise<AuditLogRow[]> {
  const supabase = await createClient();

  const primary = await supabase
    .from("audit_log")
    .select(auditSelect)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!primary.error) {
    return (primary.data ?? []) as AuditLogRow[];
  }

  if (!isMissingChangesColumn(primary.error.message)) {
    throw new Error(`Kunde inte hämta audit_log: ${primary.error.message}`);
  }

  const fallback = await supabase
    .from("audit_log")
    .select(auditSelectLegacy)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (fallback.error) {
    throw new Error(`Kunde inte hämta audit_log: ${fallback.error.message}`);
  }

  return (fallback.data ?? []).map((row) => ({
    ...row,
    changes: null,
  })) as AuditLogRow[];
}

export async function insertAuditLog(
  input: InsertAuditLogInput,
): Promise<AuditLogRow> {
  const supabase = await createClient();

  const payload = {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    action: input.action,
    description: input.description,
    actor_name: input.actor_name,
    business_area_id: input.business_area_id,
    changes: input.changes ?? null,
  };

  const primary = await supabase
    .from("audit_log")
    .insert(payload)
    .select(auditSelect)
    .single();

  if (!primary.error && primary.data) {
    return primary.data as AuditLogRow;
  }

  if (primary.error && isMissingChangesColumn(primary.error.message)) {
    const { changes: _ignored, ...legacyPayload } = payload;
    void _ignored;
    const fallback = await supabase
      .from("audit_log")
      .insert(legacyPayload)
      .select(auditSelectLegacy)
      .single();

    if (fallback.error) {
      throw new Error(`Kunde inte spara audit_log: ${fallback.error.message}`);
    }

    return { ...fallback.data, changes: null } as AuditLogRow;
  }

  throw new Error(
    `Kunde inte spara audit_log: ${primary.error?.message ?? "okänt fel"}`,
  );
}
