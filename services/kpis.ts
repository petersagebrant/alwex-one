import {
  computeKpiStatus,
  defaultToleranceTypeForTarget,
  validateGreenYellowTolerances,
  type KpiDirection,
  type KpiToleranceType,
} from "@/lib/kpi/computeStatus";
import { parseNumeric } from "@/lib/kpi/parseNumeric";
import { shouldWriteKpiMeasurementHistory } from "@/lib/kpi/shouldWriteMeasurementHistory";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import {
  fetchAllKpis,
  fetchKpiById,
  fetchKpisByBusinessAreaId,
  insertKpi,
  updateKpiRow,
  type KpiRow,
} from "@/lib/supabase/kpis";
import { recordAuditLog } from "@/services/auditLog";
import {
  collectFieldChanges,
  formatEntityChangeDescription,
  formatEntityCreateDescription,
  resolveActorName,
  snapshotCreateChanges,
} from "@/services/changeHistory";
import { addKPIHistoryEntry } from "@/services/kpiHistory";
import type {
  CreateKPIInput,
  KPI,
  KpiTrend,
  StatusTone,
  UpdateKPIInput,
} from "@/types";

const DEFAULT_ACTOR = "Peter Sagebrant";

/** Fields logged on create/update for structured from/to history. */
const KPI_TRACKED_FIELDS = [
  "name",
  "category",
  "target_value",
  "current_value",
  "unit",
  "status",
  "trend",
  "business_area_id",
  "direction",
  "tolerance_type",
  "green_tolerance",
  "yellow_tolerance",
] as const;

function toStatusTone(value: string): StatusTone {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return "Gul";
}

function toTrend(value: string): KpiTrend {
  if (value === "Upp" || value === "Oförändrad" || value === "Ner") {
    return value;
  }
  return "Oförändrad";
}

function toDirection(
  value: string | null | undefined,
): KpiDirection | null {
  if (
    value === "HIGHER_IS_BETTER" ||
    value === "LOWER_IS_BETTER" ||
    value === "TARGET_IS_BEST"
  ) {
    return value;
  }
  return null;
}

function toToleranceType(
  value: string | null | undefined,
): KpiToleranceType | null {
  if (value === "PERCENT" || value === "ABSOLUTE") {
    return value;
  }
  return null;
}

function toToleranceNumber(
  value: number | string | null | undefined,
): number | null {
  return parseNumeric(value);
}

function mapKpiRow(row: KpiRow): KPI {
  return {
    id: row.id,
    businessAreaId: row.business_area_id,
    name: row.name,
    category: row.category,
    targetValue: row.target_value,
    currentValue: row.current_value,
    unit: row.unit,
    status: toStatusTone(row.status),
    trend: toTrend(row.trend),
    direction: toDirection(row.direction),
    toleranceType: toToleranceType(row.tolerance_type),
    greenTolerance: toToleranceNumber(row.green_tolerance),
    yellowTolerance: toToleranceNumber(row.yellow_tolerance),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeAutoStatusFields(input: {
  direction?: KpiDirection | null;
  toleranceType?: KpiToleranceType | null;
  greenTolerance?: number | null;
  yellowTolerance?: number | null;
  targetValue?: string | null;
}): {
  direction: KpiDirection | null;
  tolerance_type: KpiToleranceType | null;
  green_tolerance: number | null;
  yellow_tolerance: number | null;
} {
  const direction = input.direction ?? null;
  if (!direction) {
    return {
      direction: null,
      tolerance_type: null,
      green_tolerance: null,
      yellow_tolerance: null,
    };
  }

  const yellow =
    input.yellowTolerance != null && Number.isFinite(input.yellowTolerance)
      ? input.yellowTolerance
      : null;
  const green =
    input.greenTolerance != null && Number.isFinite(input.greenTolerance)
      ? input.greenTolerance
      : null;

  const toleranceError = validateGreenYellowTolerances(green, yellow);
  if (toleranceError) {
    throw new Error(toleranceError);
  }

  return {
    direction,
    tolerance_type:
      input.toleranceType ??
      defaultToleranceTypeForTarget(input.targetValue ?? null),
    green_tolerance: green,
    yellow_tolerance: yellow,
  };
}

/** Prefer computed status when direction + values allow it. */
function resolveSnapshotStatus(input: {
  direction: KpiDirection | null;
  toleranceType: KpiToleranceType | null;
  greenTolerance: number | null;
  yellowTolerance: number | null;
  currentValue?: string | null;
  targetValue?: string | null;
  fallbackStatus: StatusTone;
}): StatusTone {
  const computed = computeKpiStatus({
    direction: input.direction,
    toleranceType: input.toleranceType,
    greenTolerance: input.greenTolerance,
    yellowTolerance: input.yellowTolerance,
    value: input.currentValue,
    target: input.targetValue,
  });
  return computed ?? input.fallbackStatus;
}

export type KPIListItem = KPI & {
  businessAreaName: string;
};

export async function getKPIsByBusinessArea(
  businessAreaId: string,
): Promise<KPI[]> {
  try {
    const rows = await fetchKpisByBusinessAreaId(businessAreaId);
    return rows.map(mapKpiRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("kpis") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }
}

export async function getKPIs(): Promise<KPIListItem[]> {
  const [rows, areas] = await Promise.all([
    fetchAllKpis(),
    fetchBusinessAreas(),
  ]);

  const areaNames = new Map(areas.map((area) => [area.id, area.name]));

  return rows.map((row) => ({
    ...mapKpiRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
  }));
}

export async function getKPIById(id: string): Promise<KPIListItem | null> {
  const row = await fetchKpiById(id);
  if (!row) {
    return null;
  }

  const areas = await fetchBusinessAreas();
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));

  return {
    ...mapKpiRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
  };
}

export async function createKPI(input: CreateKPIInput): Promise<KPI> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Namn är obligatoriskt.");
  }

  if (!input.businessAreaId) {
    throw new Error("businessAreaId är obligatoriskt.");
  }

  const auto = normalizeAutoStatusFields({
    direction: input.direction,
    toleranceType: input.toleranceType,
    greenTolerance: input.greenTolerance,
    yellowTolerance: input.yellowTolerance,
    targetValue: input.targetValue,
  });
  const targetValue = input.targetValue?.trim() || null;
  const currentValue = input.currentValue?.trim() || null;
  const status = resolveSnapshotStatus({
    direction: auto.direction,
    toleranceType: auto.tolerance_type,
    greenTolerance: auto.green_tolerance,
    yellowTolerance: auto.yellow_tolerance,
    currentValue,
    targetValue,
    fallbackStatus: input.status,
  });

  const payload = {
    business_area_id: input.businessAreaId,
    name,
    category: input.category?.trim() || null,
    target_value: targetValue,
    current_value: currentValue,
    unit: input.unit?.trim() || null,
    status,
    trend: input.trend,
    direction: auto.direction,
    tolerance_type: auto.tolerance_type,
    green_tolerance: auto.green_tolerance,
    yellow_tolerance: auto.yellow_tolerance,
  };

  const row = await insertKpi(payload);

  const createChanges = snapshotCreateChanges(payload, KPI_TRACKED_FIELDS);
  const actorName = await resolveActorName(DEFAULT_ACTOR);
  await recordAuditLog({
    entityType: "kpi",
    entityId: row.id,
    action: "created",
    description: formatEntityCreateDescription("KPI:n", row.name),
    actorName,
    businessAreaId: row.business_area_id,
    changes: createChanges.length > 0 ? { fields: createChanges } : null,
  });

  if (row.current_value || row.status) {
    try {
      await addKPIHistoryEntry(
        {
          kpiId: row.id,
          value: row.current_value?.trim() || "—",
          status: toStatusTone(row.status),
          comment: "Initial historik vid skapande",
          recordedAt: new Date().toISOString(),
        },
        // KPI row already holds current_value/status.
        { skipAudit: true, syncCurrent: false },
      );
    } catch {
      // Historik får inte blockera skapandet.
    }
  }

  return mapKpiRow(row);
}

export async function updateKPI(input: UpdateKPIInput): Promise<KPI> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Namn är obligatoriskt.");
  }

  if (!input.id) {
    throw new Error("id är obligatoriskt.");
  }

  if (!input.businessAreaId) {
    throw new Error("businessAreaId är obligatoriskt.");
  }

  const existing = await fetchKpiById(input.id);
  if (!existing) {
    throw new Error("KPI hittades inte.");
  }

  const auto = normalizeAutoStatusFields({
    direction: input.direction,
    toleranceType: input.toleranceType,
    greenTolerance: input.greenTolerance,
    yellowTolerance: input.yellowTolerance,
    targetValue: input.targetValue,
  });
  const targetValue = input.targetValue?.trim() || null;
  const currentValue = input.currentValue?.trim() || null;
  const status = resolveSnapshotStatus({
    direction: auto.direction,
    toleranceType: auto.tolerance_type,
    greenTolerance: auto.green_tolerance,
    yellowTolerance: auto.yellow_tolerance,
    currentValue,
    targetValue,
    fallbackStatus: input.status,
  });

  const next = {
    business_area_id: input.businessAreaId,
    name,
    category: input.category?.trim() || null,
    target_value: targetValue,
    current_value: currentValue,
    unit: input.unit?.trim() || null,
    status,
    trend: input.trend,
    direction: auto.direction,
    tolerance_type: auto.tolerance_type,
    green_tolerance: auto.green_tolerance,
    yellow_tolerance: auto.yellow_tolerance,
  };

  const changes = collectFieldChanges(
    {
      business_area_id: existing.business_area_id,
      name: existing.name,
      category: existing.category,
      target_value: existing.target_value,
      current_value: existing.current_value,
      unit: existing.unit,
      status: existing.status,
      trend: existing.trend,
      direction: existing.direction,
      tolerance_type: existing.tolerance_type,
      green_tolerance: toToleranceNumber(existing.green_tolerance),
      yellow_tolerance: toToleranceNumber(existing.yellow_tolerance),
    },
    next,
    KPI_TRACKED_FIELDS,
  );

  const row = await updateKpiRow(input.id, {
    ...next,
    updated_at: new Date().toISOString(),
  });

  if (changes.length > 0) {
    const actorName = await resolveActorName(DEFAULT_ACTOR);
    await recordAuditLog({
      entityType: "kpi",
      entityId: row.id,
      action: "updated",
      description: formatEntityChangeDescription("KPI:n", row.name, changes),
      actorName,
      businessAreaId: row.business_area_id,
      changes: { fields: changes },
    });

    // Measurement history only when utfall (current_value) changes.
    // Metadata (direction/tolerance/target/name/…) may recompute status on the
    // kpis row for snapshot consistency — that must not insert kpi_history.
    // Status-only admin edits also skip history; use /admin/kpis/[id] or daily
    // report for intentional measurement points.
    if (shouldWriteKpiMeasurementHistory(changes)) {
      const historyValue =
        next.current_value?.trim() ||
        existing.current_value?.trim() ||
        "—";
      try {
        await addKPIHistoryEntry(
          {
            kpiId: row.id,
            value: historyValue,
            status: toStatusTone(next.status),
            comment: "Automatisk historik vid KPI-uppdatering",
            recordedAt: new Date().toISOString(),
          },
          // KPI row already updated above.
          { skipAudit: true, syncCurrent: false },
        );
      } catch {
        // Historik får inte blockera huvuduppdateringen.
      }
    }
  }

  return mapKpiRow(row);
}
