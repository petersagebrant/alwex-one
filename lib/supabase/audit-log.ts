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
};

export type InsertAuditLogInput = {
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string;
  actor_name: string;
  business_area_id: string | null;
};

const auditSelect =
  "id, entity_type, entity_id, action, description, actor_name, business_area_id, created_at";

export async function fetchRecentAuditLog(
  limit = 10,
): Promise<AuditLogRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_log")
    .select(auditSelect)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Kunde inte hämta audit_log: ${error.message}`);
  }

  return data ?? [];
}

export async function insertAuditLog(
  input: InsertAuditLogInput,
): Promise<AuditLogRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_log")
    .insert(input)
    .select(auditSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara audit_log: ${error.message}`);
  }

  return data;
}
