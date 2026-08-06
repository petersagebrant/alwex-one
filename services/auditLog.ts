import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import {
  fetchRecentAuditLog,
  insertAuditLog,
} from "@/lib/supabase/audit-log";
import type { AuditLogEntry, CreateAuditLogInput } from "@/types";

function mapAuditLogRow(row: {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string;
  actor_name: string;
  business_area_id: string | null;
  created_at: string;
}): AuditLogEntry {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    description: row.description,
    actorName: row.actor_name,
    businessAreaId: row.business_area_id,
    createdAt: row.created_at,
  };
}

export type AuditLogListItem = AuditLogEntry & {
  href: string | null;
};

function resolveHref(
  entry: AuditLogEntry,
  areaSlugById: Map<string, string>,
): string | null {
  switch (entry.entityType) {
    case "business_area": {
      if (entry.entityId) {
        const slug = areaSlugById.get(entry.entityId);
        if (slug) {
          return `/areas/${slug}`;
        }
      }
      return "/areas";
    }
    case "goal":
      return "/admin/goals";
    case "activity":
      return entry.entityId
        ? `/activities/${entry.entityId}`
        : "/admin/activities";
    case "decision":
      return entry.entityId
        ? `/admin/decisions?edit=${entry.entityId}`
        : "/admin/decisions";
    case "activity_comment":
      return entry.entityId ? `/activities/${entry.entityId}` : null;
    case "kpi":
      return entry.entityId
        ? `/admin/kpis?edit=${entry.entityId}`
        : "/admin/kpis";
    default:
      return null;
  }
}

export async function getRecentAuditLog(
  limit = 10,
): Promise<AuditLogListItem[]> {
  try {
    const [rows, areas] = await Promise.all([
      fetchRecentAuditLog(limit),
      fetchBusinessAreas(),
    ]);

    const areaSlugById = new Map(areas.map((area) => [area.id, area.slug]));

    return rows.map((row) => {
      const entry = mapAuditLogRow(row);
      return {
        ...entry,
        href: resolveHref(entry, areaSlugById),
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("audit_log") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }
}

export async function createAuditLogEntry(
  input: CreateAuditLogInput,
): Promise<AuditLogEntry> {
  const description = input.description.trim();
  const actorName = input.actorName.trim();
  const action = input.action.trim();
  const entityType = input.entityType.trim();

  if (!entityType) {
    throw new Error("entityType är obligatoriskt.");
  }

  if (!action) {
    throw new Error("action är obligatoriskt.");
  }

  if (!description) {
    throw new Error("description är obligatoriskt.");
  }

  if (!actorName) {
    throw new Error("actorName är obligatoriskt.");
  }

  const row = await insertAuditLog({
    entity_type: entityType,
    entity_id: input.entityId ?? null,
    action,
    description,
    actor_name: actorName,
    business_area_id: input.businessAreaId ?? null,
  });

  return mapAuditLogRow(row);
}

/** Best-effort loggning — får inte blockera huvudflödet. */
export async function recordAuditLog(
  input: CreateAuditLogInput,
): Promise<void> {
  try {
    await createAuditLogEntry(input);
  } catch {
    // Tabellen kan saknas tills migrationen körts, eller RLS kan blockera.
  }
}
