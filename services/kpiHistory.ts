import {
  fetchKpiHistoryByKpiId,
  fetchKpiHistorySince,
  fetchRecentKpiHistory,
  fetchRecentKpiHistoryForKpis,
  insertKpiHistory,
} from "@/lib/supabase/kpi-history";
import { fetchKpiById } from "@/lib/supabase/kpis";
import { recordAuditLog } from "@/services/auditLog";
import {
  collectFieldChanges,
  formatEntityChangeDescription,
  resolveActorName,
} from "@/services/changeHistory";
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

function parseNumericValue(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
  options?: { skipAudit?: boolean },
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

  const kpi = await fetchKpiById(kpiId).catch(() => null);
  const previousHistory = await fetchKpiHistoryByKpiId(kpiId).catch(() => []);
  const prior =
    previousHistory
      .map(mapKpiHistoryRow)
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      )[0] ?? null;

  const row = await insertKpiHistory({
    kpi_id: kpiId,
    value,
    status: input.status,
    comment: input.comment?.trim() || null,
    recorded_at: recordedAt.toISOString(),
  });

  if (!options?.skipAudit) {
    try {
      const changes = collectFieldChanges(
        {
          current_value: prior?.value ?? kpi?.current_value ?? null,
          status: prior?.status ?? kpi?.status ?? null,
        },
        {
          current_value: value,
          status: input.status,
        },
        ["current_value", "status"],
      );

      if (changes.length > 0) {
        const actorName = await resolveActorName("System");
        await recordAuditLog({
          entityType: "kpi",
          entityId: kpiId,
          action: "history_recorded",
          description: formatEntityChangeDescription(
            "KPI:n",
            kpi?.name ?? "KPI",
            changes,
          ),
          actorName,
          businessAreaId: kpi?.business_area_id ?? null,
          changes: { fields: changes },
        });
      }
    } catch {
      // Audit runt historik får inte blockera sparandet.
    }
  }

  return mapKpiHistoryRow(row);
}

export async function getRecentKpiHistoryEntries(
  limit = 20,
): Promise<KPIHistory[]> {
  try {
    const rows = await fetchRecentKpiHistory(limit);
    return rows.map(mapKpiHistoryRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("kpi_history") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }
}

/** Latest N history rows per KPI (newest first within each KPI). */
export async function getRecentKpiHistoryForKpis(
  kpiIds: string[],
  limitPerKpi = 3,
): Promise<KPIHistory[]> {
  if (kpiIds.length === 0) {
    return [];
  }

  try {
    const rows = await fetchRecentKpiHistoryForKpis(kpiIds, limitPerKpi);
    return rows.map(mapKpiHistoryRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("kpi_history") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }
}

export type KpiHistoryChangeLine = {
  id: string;
  text: string;
};

export async function getKpiHistoryChangeLinesSince(
  cutoff: Date,
  kpiNames: Map<string, string>,
): Promise<KpiHistoryChangeLine[]> {
  try {
    const recentRows = await fetchKpiHistorySince(cutoff.toISOString());
    if (recentRows.length === 0) {
      return [];
    }

    const kpiIds = [...new Set(recentRows.map((row) => row.kpi_id))];
    const recentByKpi = await fetchRecentKpiHistoryForKpis(kpiIds, 2);
    const byKpi = new Map<string, typeof recentByKpi>();

    for (const row of recentByKpi) {
      const list = byKpi.get(row.kpi_id) ?? [];
      list.push(row);
      byKpi.set(row.kpi_id, list);
    }

    const lines: KpiHistoryChangeLine[] = [];

    for (const kpiId of kpiIds) {
      const entries = byKpi.get(kpiId) ?? [];
      if (entries.length === 0) {
        continue;
      }

      const name = kpiNames.get(kpiId) ?? "KPI";
      const latest = entries[0];
      const previous = entries[1];

      if (!previous) {
        lines.push({
          id: `kpi-history-${latest.id}`,
          text: `${name} uppdaterad`,
        });
        continue;
      }

      const latestNum = parseNumericValue(latest.value);
      const previousNum = parseNumericValue(previous.value);

      if (latestNum === null || previousNum === null || previousNum === 0) {
        lines.push({
          id: `kpi-history-${latest.id}`,
          text: `${name} uppdaterad`,
        });
        continue;
      }

      const changePercent =
        ((latestNum - previousNum) / Math.abs(previousNum)) * 100;
      const absolute = Math.abs(changePercent).toLocaleString("sv-SE", {
        maximumFractionDigits: 1,
        minimumFractionDigits: Number.isInteger(Math.abs(changePercent))
          ? 0
          : 1,
      });
      const sign = changePercent > 0 ? "+" : changePercent < 0 ? "−" : "";

      lines.push({
        id: `kpi-history-${latest.id}`,
        text: `${name} ${sign}${absolute} %`,
      });
    }

    return lines;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("kpi_history") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }
}
