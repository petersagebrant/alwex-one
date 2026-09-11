import { requireUserAdministrator } from "@/lib/auth/require-user";
import { isAlwexTotaltSlug } from "@/lib/notices/visibility";
import {
  fetchReportingUnitById,
  fetchReportingUnits,
  insertReportingUnit,
  reportingUnitCodeExists,
  updateReportingUnitRow,
  type ReportingUnitRow,
} from "@/lib/supabase/reporting-units";
import { fetchAreaNoticeAreaLabels } from "@/lib/supabase/area-notices";
import { slugifyName } from "@/services/businessAreas";

export type ReportingUnitListItem = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  defaultBusinessAreaId: string | null;
  defaultBusinessAreaName: string | null;
  sortOrder: number;
  createdAt: string;
};

export type UpsertReportingUnitInput = {
  name: string;
  code?: string;
  isActive: boolean;
  defaultBusinessAreaId: string | null;
  sortOrder?: number;
};

const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function mapRow(
  row: ReportingUnitRow,
  areaName: string | null,
): ReportingUnitListItem {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    isActive: row.is_active,
    defaultBusinessAreaId: row.default_business_area_id,
    defaultBusinessAreaName: areaName,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function normalizeName(value: string): string {
  return value.trim();
}

function normalizeCode(value: string): string {
  return slugifyName(value);
}

function parseOptionalAreaId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

async function requireAvailableCode(
  code: string,
  exceptId?: string,
): Promise<string> {
  if (await reportingUnitCodeExists(code, exceptId)) {
    throw new Error("Koden används redan.");
  }
  return code;
}

async function uniqueCode(base: string, exceptId?: string): Promise<string> {
  const root = base || "enhet";
  let candidate = root;
  let suffix = 2;

  while (await reportingUnitCodeExists(candidate, exceptId)) {
    candidate = `${root}-${suffix}`.slice(0, 60);
    suffix += 1;
  }

  return candidate;
}

async function operationalAreaIds(): Promise<Set<string>> {
  const labels = await fetchAreaNoticeAreaLabels();
  return new Set(
    labels
      .filter((label) => !isAlwexTotaltSlug(label.slug))
      .map((label) => label.id),
  );
}

async function assertValidDefaultArea(
  defaultBusinessAreaId: string | null,
): Promise<void> {
  if (!defaultBusinessAreaId) {
    return;
  }
  const allowed = await operationalAreaIds();
  if (!allowed.has(defaultBusinessAreaId)) {
    throw new Error("Ogiltigt förvalt affärsområde.");
  }
}

export async function getReportingUnits(): Promise<ReportingUnitListItem[]> {
  await requireUserAdministrator();
  const [rows, labels] = await Promise.all([
    fetchReportingUnits(),
    fetchAreaNoticeAreaLabels(),
  ]);
  const names = new Map(labels.map((label) => [label.id, label.name]));
  return rows.map((row) =>
    mapRow(
      row,
      row.default_business_area_id
        ? (names.get(row.default_business_area_id) ?? null)
        : null,
    ),
  );
}

export async function createReportingUnit(
  input: UpsertReportingUnitInput,
): Promise<ReportingUnitListItem> {
  await requireUserAdministrator();
  const name = normalizeName(input.name);
  if (!name) {
    throw new Error("Ange namn.");
  }
  if (name.length > 120) {
    throw new Error("Namnet får vara högst 120 tecken.");
  }

  const providedCode = input.code?.trim() ?? "";
  const requested = normalizeCode(providedCode || name);
  if (!requested || !CODE_PATTERN.test(requested)) {
    throw new Error("Ange en giltig kod (a-z, 0-9 och bindestreck).");
  }

  const defaultBusinessAreaId = parseOptionalAreaId(input.defaultBusinessAreaId);
  await assertValidDefaultArea(defaultBusinessAreaId);

  const code = providedCode
    ? await requireAvailableCode(requested)
    : await uniqueCode(requested);
  const row = await insertReportingUnit({
    name,
    code,
    is_active: input.isActive,
    default_business_area_id: defaultBusinessAreaId,
    sort_order: input.sortOrder ?? 0,
  });

  return mapRow(row, null);
}

export async function updateReportingUnit(
  id: string,
  input: UpsertReportingUnitInput,
): Promise<ReportingUnitListItem> {
  await requireUserAdministrator();
  if (!id.trim()) {
    throw new Error("Saknar rapportenhet.");
  }

  const existing = await fetchReportingUnitById(id);
  if (!existing) {
    throw new Error("Rapportenheten hittades inte.");
  }

  const name = normalizeName(input.name);
  if (!name) {
    throw new Error("Ange namn.");
  }
  if (name.length > 120) {
    throw new Error("Namnet får vara högst 120 tecken.");
  }

  const providedCode = input.code?.trim() ?? "";
  const requested = normalizeCode(providedCode || existing.code);
  if (!requested || !CODE_PATTERN.test(requested)) {
    throw new Error("Ange en giltig kod (a-z, 0-9 och bindestreck).");
  }

  const defaultBusinessAreaId = parseOptionalAreaId(input.defaultBusinessAreaId);
  await assertValidDefaultArea(defaultBusinessAreaId);

  const code = await requireAvailableCode(requested, id);
  const row = await updateReportingUnitRow(id, {
    name,
    code,
    is_active: input.isActive,
    default_business_area_id: defaultBusinessAreaId,
    sort_order: input.sortOrder ?? existing.sort_order,
  });

  return mapRow(row, null);
}

export async function setReportingUnitActive(
  id: string,
  isActive: boolean,
): Promise<ReportingUnitListItem> {
  await requireUserAdministrator();
  const existing = await fetchReportingUnitById(id);
  if (!existing) {
    throw new Error("Rapportenheten hittades inte.");
  }

  const row = await updateReportingUnitRow(id, {
    name: existing.name,
    code: existing.code,
    is_active: isActive,
    default_business_area_id: existing.default_business_area_id,
    sort_order: existing.sort_order,
  });

  return mapRow(row, null);
}
