import {
  fetchBusinessAreaById,
  fetchBusinessAreas,
} from "@/lib/supabase/business-areas";
import {
  fetchAuditLogByBusinessAreaId,
  fetchAuditLogSince,
  fetchRecentAuditLog,
  insertAuditLog,
} from "@/lib/supabase/audit-log";
import type {
  AuditChangesPayload,
  AuditFieldChange,
  AuditLogEntry,
  CreateAuditLogInput,
  HistoryEvent,
} from "@/types";

function parseChanges(value: unknown): AuditChangesPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const fields = (value as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) {
    return null;
  }

  const parsed: AuditFieldChange[] = [];
  for (const item of fields) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    if (typeof row.field !== "string") {
      continue;
    }
    parsed.push({
      field: row.field,
      from:
        row.from === null || row.from === undefined
          ? null
          : String(row.from),
      to: row.to === null || row.to === undefined ? null : String(row.to),
    });
  }

  return parsed.length > 0 ? { fields: parsed } : null;
}

function mapAuditLogRow(row: {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string;
  actor_name: string;
  business_area_id: string | null;
  created_at: string;
  changes?: unknown | null;
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
    changes: parseChanges(row.changes),
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
      return entry.entityId
        ? `/admin/goals/${entry.entityId}`
        : "/admin/goals";
    case "activity":
      return entry.entityId
        ? `/activities/${entry.entityId}`
        : "/admin/activities";
    case "decision":
      return entry.entityId
        ? `/admin/decisions/${entry.entityId}`
        : "/admin/decisions";
    case "activity_comment":
      return entry.entityId ? `/activities/${entry.entityId}` : null;
    case "kpi":
      return entry.entityId
        ? `/admin/kpis/${entry.entityId}`
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

export async function getBusinessAreaHistory(
  businessAreaId: string,
  areaSlug: string,
  limit = 50,
): Promise<HistoryEvent[]> {
  const rows = await fetchAuditLogByBusinessAreaId(businessAreaId, limit);

  return rows.map((row) => ({
    id: row.id,
    areaSlug,
    date: row.created_at,
    title: row.description,
    detail: `Utförd av ${row.actor_name}`,
  }));
}

export async function getAuditLogSince(
  cutoff: Date,
  limit = 150,
  businessAreaId?: string,
): Promise<AuditLogListItem[]> {
  try {
    const [rows, areas] = await Promise.all([
      businessAreaId
        ? fetchAuditLogByBusinessAreaId(businessAreaId, limit).then((all) =>
            all.filter((row) => row.created_at >= cutoff.toISOString()),
          )
        : fetchAuditLogSince(cutoff.toISOString(), limit),
      businessAreaId
        ? fetchBusinessAreaById(businessAreaId).then((area) =>
            area ? [area] : [],
          )
        : fetchBusinessAreas(),
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
    changes: input.changes ?? null,
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
