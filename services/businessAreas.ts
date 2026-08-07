import { activities, goals } from "@/data/mock";
import {
  businessAreaSlugExists,
  fetchBusinessAreaById,
  fetchBusinessAreas,
  insertBusinessArea,
  updateBusinessAreaRow,
  type BusinessAreaRow,
} from "@/lib/supabase/business-areas";
import { recordAuditLog } from "@/services/auditLog";
import {
  collectFieldChanges,
  formatEntityChangeDescription,
  formatEntityCreateDescription,
  resolveActorName,
  snapshotCreateChanges,
} from "@/services/changeHistory";
import type {
  BusinessAreaSummary,
  StatusTone,
  UpdateBusinessAreaInput,
} from "@/types";

const DEFAULT_ACTOR = "Peter Sagebrant";

const AREA_TRACKED_FIELDS = [
  "name",
  "manager",
  "status",
  "description",
  "vd_comment",
] as const;

function toStatusTone(value: string): StatusTone {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return "Gul";
}

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = base || "verksamhet";
  let candidate = root;
  let suffix = 2;

  while (await businessAreaSlugExists(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function getBusinessAreas(): Promise<BusinessAreaSummary[]> {
  const rows = await fetchBusinessAreas();

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    manager: row.manager ?? "Ej angiven",
    status: toStatusTone(row.status),
    updatedAt: toDateKey(row.updated_at),
    goalCount: goals.filter((goal) => goal.areaSlug === row.slug).length,
    activityCount: activities.filter(
      (activity) => activity.areaSlug === row.slug,
    ).length,
  }));
}

export async function getBusinessAreaOptions(): Promise<
  { id: string; name: string }[]
> {
  const rows = await fetchBusinessAreas();
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export type CreateBusinessAreaData = {
  name: string;
  manager: string;
  description: string;
  status: StatusTone;
};

export type BusinessAreaDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  manager: string | null;
  status: StatusTone;
  vdComment: string | null;
  updatedAt: string;
};

function mapBusinessAreaDetail(row: BusinessAreaRow): BusinessAreaDetail {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    manager: row.manager,
    status: toStatusTone(row.status),
    vdComment: row.vd_comment,
    updatedAt: row.updated_at,
  };
}

export async function getBusinessAreaById(
  id: string,
): Promise<BusinessAreaDetail | null> {
  const row = await fetchBusinessAreaById(id);
  if (!row) {
    return null;
  }
  return mapBusinessAreaDetail(row);
}

export async function createBusinessArea(
  data: CreateBusinessAreaData,
): Promise<void> {
  const name = data.name.trim();
  if (!name) {
    throw new Error("Namn är obligatoriskt.");
  }

  const slug = await uniqueSlug(slugifyName(name));

  const payload = {
    name,
    slug,
    description: data.description.trim(),
    manager: data.manager.trim(),
    status: data.status,
  };

  const row = await insertBusinessArea(payload);

  const createChanges = snapshotCreateChanges(
    {
      name: payload.name,
      manager: payload.manager,
      status: payload.status,
      description: payload.description,
      vd_comment: null,
    },
    AREA_TRACKED_FIELDS,
  );
  const actorName = await resolveActorName(
    data.manager.trim() || DEFAULT_ACTOR,
  );
  await recordAuditLog({
    entityType: "business_area",
    entityId: row.id,
    action: "created",
    description: formatEntityCreateDescription("affärsområdet", row.name),
    actorName,
    businessAreaId: row.id,
    changes: createChanges.length > 0 ? { fields: createChanges } : null,
  });
}

export async function updateBusinessArea(
  input: UpdateBusinessAreaInput,
): Promise<BusinessAreaDetail> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Namn är obligatoriskt.");
  }

  if (!input.id) {
    throw new Error("id är obligatoriskt.");
  }

  const existing = await fetchBusinessAreaById(input.id);
  if (!existing) {
    throw new Error("Affärsområdet hittades inte.");
  }

  const next = {
    name,
    description: input.description.trim() || null,
    manager: input.manager.trim() || null,
    status: input.status,
    vd_comment: input.vdComment.trim() || null,
  };

  const changes = collectFieldChanges(
    {
      name: existing.name,
      description: existing.description,
      manager: existing.manager,
      status: existing.status,
      vd_comment: existing.vd_comment,
    },
    next,
    AREA_TRACKED_FIELDS,
  );

  const row = await updateBusinessAreaRow(input.id, {
    ...next,
    updated_at: new Date().toISOString(),
  });

  if (changes.length > 0) {
    const actorName = await resolveActorName(
      input.manager.trim() || DEFAULT_ACTOR,
    );
    await recordAuditLog({
      entityType: "business_area",
      entityId: row.id,
      action: "updated",
      description: formatEntityChangeDescription(
        "affärsområdet",
        row.name,
        changes,
      ),
      actorName,
      businessAreaId: row.id,
      changes: { fields: changes },
    });
  }

  return mapBusinessAreaDetail(row);
}
