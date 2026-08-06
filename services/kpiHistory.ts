import {
  fetchKpiHistoryByKpiId,
  insertKpiHistory,
} from "@/lib/supabase/kpi-history";
import type { CreateKPIHistoryInput, KPIHistory, StatusTone } from "@/types";

function toStatusTone(value: string): StatusTone {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return "Gul";
}

function mapKpiHistoryRow(row: {
  id: string;
  kpi_id: string;
  value: string;
  status: string;
  comment: string | null;
  recorded_at: string;
  created_at: string;
}): KPIHistory {
  return {
    id: row.id,
    kpiId: row.kpi_id,
    value: row.value,
    status: toStatusTone(row.status),
    comment: row.comment,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

export async function getKPIHistory(kpiId: string): Promise<KPIHistory[]> {
  if (!kpiId.trim()) {
    throw new Error("kpiId är obligatoriskt.");
  }

  try {
    const rows = await fetchKpiHistoryByKpiId(kpiId);
    return rows.map(mapKpiHistoryRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("kpi_history") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }
}

export async function addKPIHistoryEntry(
  input: CreateKPIHistoryInput,
): Promise<KPIHistory> {
  const kpiId = input.kpiId.trim();
  if (!kpiId) {
    throw new Error("kpiId är obligatoriskt.");
  }

  const value = input.value.trim();
  if (!value) {
    throw new Error("Värde är obligatoriskt.");
  }

  if (!input.recordedAt.trim()) {
    throw new Error("Datum är obligatoriskt.");
  }

  const recordedAtRaw = input.recordedAt.trim();
  const recordedAt = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(recordedAtRaw)
      ? `${recordedAtRaw}T12:00:00`
      : recordedAtRaw,
  );
  if (Number.isNaN(recordedAt.getTime())) {
    throw new Error("Ogiltigt datum.");
  }

  const row = await insertKpiHistory({
    kpi_id: kpiId,
    value,
    status: input.status,
    comment: input.comment?.trim() || null,
    recorded_at: recordedAt.toISOString(),
  });

  return mapKpiHistoryRow(row);
}
