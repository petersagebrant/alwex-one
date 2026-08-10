import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import {
  fetchAllKpis,
  fetchKpiById,
  fetchKpisByBusinessAreaId,
  insertKpi,
  updateKpiRow,
} from "@/lib/supabase/kpis";
import { recordAuditLog } from "@/services/auditLog";
import {
  collectFieldChanges,
  formatEntityChangeDescription,
  formatEntityCreateDescription,
  hasFieldChange,
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

function mapKpiRow(row: {
  id: string;
  business_area_id: string;
  name: string;
  category: string | null;
  target_value: string | null;
  current_value: string | null;
  unit: string | null;
  status: string;
  trend: string;
  created_at: string;
  updated_at: string;
}): KPI {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

  const payload = {
    business_area_id: input.businessAreaId,
    name,
    category: input.category?.trim() || null,
    target_value: input.targetValue?.trim() || null,
    current_value: input.currentValue?.trim() || null,
    unit: input.unit?.trim() || null,
    status: input.status,
    trend: input.trend,
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

  const next = {
    business_area_id: input.businessAreaId,
    name,
    category: input.category?.trim() || null,
    target_value: input.targetValue?.trim() || null,
    current_value: input.currentValue?.trim() || null,
    unit: input.unit?.trim() || null,
    status: input.status,
    trend: input.trend,
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

    if (hasFieldChange(changes, "current_value", "status")) {
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
