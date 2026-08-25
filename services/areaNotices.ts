import { parseAreaNoticeKind } from "@/lib/notices/kind";
import { canWriteAreaNoticesForArea } from "@/lib/notices/permissions";
import { rankDashboardNotices } from "@/lib/notices/rank";
import {
  currentAreaNoticesOnly,
  isAlwexTotaltSlug,
} from "@/lib/notices/visibility";
import { requireOperationalWriter } from "@/lib/auth/require-user";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import {
  fetchAllAreaNotices,
  fetchAreaNoticeAreaLabels,
  fetchAreaNoticeById,
  fetchAreaNoticesByBusinessAreaId,
  insertAreaNotice,
  updateAreaNoticeArchivedAt,
  updateAreaNoticeRow,
  type AreaNoticeAreaLabel,
  type AreaNoticeRow,
} from "@/lib/supabase/area-notices";
import {
  fetchBusinessAreaById,
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
  AreaNotice,
  CreateAreaNoticeInput,
  UpdateAreaNoticeInput,
} from "@/types/area-notice";

const DEFAULT_ACTOR = "Peter Sagebrant";

const NOTICE_TRACKED_FIELDS = [
  "title",
  "body",
  "kind",
  "ends_on",
  "business_area_id",
  "archived_at",
] as const;

function mapNoticeRow(row: AreaNoticeRow): AreaNotice {
  return {
    id: row.id,
    businessAreaId: row.business_area_id,
    kind: parseAreaNoticeKind(row.kind),
    title: row.title,
    body: row.body,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdByName: row.created_by_name ?? "",
    updatedByName: row.updated_by_name ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    endsOn: row.ends_on,
    archivedAt: row.archived_at,
  };
}

export type AreaNoticeListItem = AreaNotice & {
  businessAreaName: string;
  businessAreaSlug: string;
};

function attachArea(
  notice: AreaNotice,
  labels: Map<string, AreaNoticeAreaLabel>,
): AreaNoticeListItem {
  const area = labels.get(notice.businessAreaId);
  return {
    ...notice,
    businessAreaName: area?.name ?? "Okänt område",
    businessAreaSlug: area?.slug ?? "",
  };
}

function labelMap(
  labels: AreaNoticeAreaLabel[],
): Map<string, AreaNoticeAreaLabel> {
  return new Map(labels.map((label) => [label.id, label]));
}

async function requireWritableArea(areaId: string): Promise<AreaNoticeAreaLabel> {
  const profile = await requireOperationalWriter();
  if (
    !canWriteAreaNoticesForArea(
      profile.role,
      profile.businessAreaId,
      areaId,
    )
  ) {
    throw new Error("Du saknar behörighet att skriva Aktuellt för området.");
  }

  const area = await fetchBusinessAreaById(areaId);
  if (!area) {
    throw new Error("Affärsområdet hittades inte.");
  }
  if (isAlwexTotaltSlug(area.slug)) {
    throw new Error("Aktuellt kan inte skapas för Alwex totalt.");
  }

  return { id: area.id, name: area.name, slug: area.slug };
}

async function actorSnapshot(): Promise<{ id: string; name: string }> {
  const profile = await requireOperationalWriter();
  const row = await fetchProfileByUserId(profile.id).catch(() => null);
  const name =
    row?.display_name.trim() ||
    (await resolveActorName(DEFAULT_ACTOR));
  return { id: profile.id, name };
}

export async function getAreaNoticesByBusinessAreaId(
  businessAreaId: string,
  options?: { includeArchived?: boolean },
): Promise<AreaNoticeListItem[]> {
  const [rows, labels] = await Promise.all([
    fetchAreaNoticesByBusinessAreaId(businessAreaId, {
      includeArchived: options?.includeArchived ?? false,
    }),
    fetchAreaNoticeAreaLabels(),
  ]);
  const areas = labelMap(labels);
  return rows.map((row) => attachArea(mapNoticeRow(row), areas));
}

export async function getCurrentAreaNoticesByBusinessAreaId(
  businessAreaId: string,
): Promise<AreaNoticeListItem[]> {
  const notices = await getAreaNoticesByBusinessAreaId(businessAreaId);
  return currentAreaNoticesOnly(notices);
}

export async function getAreaNotices(options?: {
  includeArchived?: boolean;
}): Promise<AreaNoticeListItem[]> {
  const [rows, labels] = await Promise.all([
    fetchAllAreaNotices({
      includeArchived: options?.includeArchived ?? false,
    }),
    fetchAreaNoticeAreaLabels(),
  ]);
  const areas = labelMap(labels);
  return rows
    .map((row) => attachArea(mapNoticeRow(row), areas))
    .filter((notice) => !isAlwexTotaltSlug(notice.businessAreaSlug));
}

export async function getDashboardAreaNotices(): Promise<AreaNoticeListItem[]> {
  const notices = await getAreaNotices();
  return rankDashboardNotices(currentAreaNoticesOnly(notices));
}

export async function getAreaNoticeById(
  id: string,
): Promise<AreaNoticeListItem | null> {
  const [row, labels] = await Promise.all([
    fetchAreaNoticeById(id),
    fetchAreaNoticeAreaLabels(),
  ]);
  if (!row) {
    return null;
  }
  return attachArea(mapNoticeRow(row), labelMap(labels));
}

export async function getOperationalAreaNoticeOptions(): Promise<
  { id: string; name: string }[]
> {
  const labels = await fetchAreaNoticeAreaLabels();
  return labels
    .filter((label) => !isAlwexTotaltSlug(label.slug))
    .map((label) => ({ id: label.id, name: label.name }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, "sv", { sensitivity: "base" }),
    );
}

export async function createAreaNotice(
  input: CreateAreaNoticeInput,
): Promise<AreaNotice> {
  const area = await requireWritableArea(input.businessAreaId);
  const actor = await actorSnapshot();
  const payload = {
    business_area_id: area.id,
    kind: parseAreaNoticeKind(input.kind),
    title: input.title.trim(),
    body: input.body.trim(),
    created_by: actor.id,
    updated_by: actor.id,
    created_by_name: actor.name,
    updated_by_name: actor.name,
    ends_on: input.endsOn?.trim() || null,
  };

  const row = await insertAreaNotice(payload);
  const createChanges = snapshotCreateChanges(payload, NOTICE_TRACKED_FIELDS);
  await recordAuditLog({
    entityType: "area_notice",
    entityId: row.id,
    action: "created",
    description: formatEntityCreateDescription("aktuellt-inlägget", row.title),
    actorName: actor.name,
    businessAreaId: row.business_area_id,
    changes: { fields: createChanges },
  });

  return mapNoticeRow(row);
}

export async function updateAreaNotice(
  input: UpdateAreaNoticeInput,
): Promise<AreaNotice> {
  const existing = await fetchAreaNoticeById(input.id);
  if (!existing) {
    throw new Error("Inlägget hittades inte.");
  }

  const area = await requireWritableArea(input.businessAreaId);
  await requireWritableArea(existing.business_area_id);
  const actor = await actorSnapshot();

  const next = {
    business_area_id: area.id,
    kind: parseAreaNoticeKind(input.kind),
    title: input.title.trim(),
    body: input.body.trim(),
    updated_by: actor.id,
    updated_by_name: actor.name,
    ends_on: input.endsOn?.trim() || null,
  };

  const changes = collectFieldChanges(
    {
      business_area_id: existing.business_area_id,
      title: existing.title,
      body: existing.body,
      kind: existing.kind,
      ends_on: existing.ends_on,
      archived_at: existing.archived_at,
    },
    next,
    NOTICE_TRACKED_FIELDS,
  );

  const row = await updateAreaNoticeRow(input.id, next);

  if (changes.length > 0) {
    await recordAuditLog({
      entityType: "area_notice",
      entityId: row.id,
      action: "updated",
      description: formatEntityChangeDescription(
        "aktuellt-inlägget",
        row.title,
        changes,
      ),
      actorName: actor.name,
      businessAreaId: row.business_area_id,
      changes: { fields: changes },
    });
  }

  return mapNoticeRow(row);
}

export async function archiveAreaNotice(id: string): Promise<AreaNoticeListItem> {
  const existing = await fetchAreaNoticeById(id);
  if (!existing) {
    throw new Error("Inlägget hittades inte.");
  }
  if (existing.archived_at) {
    throw new Error("Inlägget är redan arkiverat.");
  }

  await requireWritableArea(existing.business_area_id);
  const actor = await actorSnapshot();
  const row = await updateAreaNoticeArchivedAt(id, new Date().toISOString(), actor);
  const labels = labelMap(await fetchAreaNoticeAreaLabels());
  const mapped = attachArea(mapNoticeRow(row), labels);

  await recordAuditLog({
    entityType: "area_notice",
    entityId: row.id,
    action: "updated",
    description: `Aktuellt-inlägget "${row.title}" arkiverades (${mapped.businessAreaName}).`,
    actorName: actor.name,
    businessAreaId: row.business_area_id,
    changes: {
      fields: [
        {
          field: "archived_at",
          from: existing.archived_at,
          to: row.archived_at,
        },
      ],
    },
  });

  return mapped;
}

export async function unarchiveAreaNotice(
  id: string,
): Promise<AreaNoticeListItem> {
  const existing = await fetchAreaNoticeById(id);
  if (!existing) {
    throw new Error("Inlägget hittades inte.");
  }
  if (!existing.archived_at) {
    throw new Error("Inlägget är inte arkiverat.");
  }

  await requireWritableArea(existing.business_area_id);
  const actor = await actorSnapshot();
  const row = await updateAreaNoticeArchivedAt(id, null, actor);
  const labels = labelMap(await fetchAreaNoticeAreaLabels());
  const mapped = attachArea(mapNoticeRow(row), labels);

  await recordAuditLog({
    entityType: "area_notice",
    entityId: row.id,
    action: "updated",
    description: `Aktuellt-inlägget "${row.title}" återaktiverades (${mapped.businessAreaName}).`,
    actorName: actor.name,
    businessAreaId: row.business_area_id,
    changes: {
      fields: [
        {
          field: "archived_at",
          from: existing.archived_at,
          to: null,
        },
      ],
    },
  });

  return mapped;
}
