import { getCurrentUser } from "@/lib/auth/require-user";
import {
  fetchKpiHistoryByKpiId,
  fetchKpiHistorySince,
  fetchRecentKpiHistory,
  fetchRecentKpiHistoryForKpis,
  insertKpiHistory,
  upsertDailyKpiReportRow,
  type KpiHistoryRow,
} from "@/lib/supabase/kpi-history";
import { fetchKpiById, updateKpiCurrentSnapshot } from "@/lib/supabase/kpis";
import { recordAuditLog } from "@/services/auditLog";
import {
  collectFieldChanges,
  formatEntityChangeDescription,
  resolveActorName,
} from "@/services/changeHistory";
import { parseKpiStoredStatus } from "@/lib/kpi/kind";
import type {
  CreateKPIHistoryInput,
  KPIHistory,
  KpiStoredStatus,
  UpsertDailyKpiReportInput,
} from "@/types";

function mapKpiHistoryRow(row: KpiHistoryRow): KPIHistory {
  return {
    id: row.id,
    kpiId: row.kpi_id,
    value: row.value,
    status: parseKpiStoredStatus(row.status),
    comment: row.comment,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    reportDate: row.report_date ?? null,
    recordedBy: row.recorded_by ?? null,
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

/** YYYY-MM-DD for a Date in Europe/Stockholm. */
export function toStockholmReportDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isValidReportDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Sync kpis.current_value / status / updated_at when the history entry
 * is the newest for that KPI (by recorded_at). Backdated inserts do not
 * overwrite the current snapshot.
 */
async function syncCurrentKpiFromHistory(input: {
  kpiId: string;
  value: string;
  status: KpiStoredStatus;
  recordedAt: Date;
  existingNewestRecordedAt: string | null;
}): Promise<void> {
  const existingMs = input.existingNewestRecordedAt
    ? new Date(input.existingNewestRecordedAt).getTime()
    : null;
  const nextMs = input.recordedAt.getTime();

  if (
    existingMs !== null &&
    !Number.isNaN(existingMs) &&
    nextMs < existingMs
  ) {
    return;
  }

  await updateKpiCurrentSnapshot(input.kpiId, {
    current_value: input.value,
    status: input.status,
    updated_at: new Date().toISOString(),
  });
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
  options?: { skipAudit?: boolean; syncCurrent?: boolean },
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

  const currentUser = await getCurrentUser().catch(() => null);
  const recordedBy =
    input.recordedBy !== undefined
      ? input.recordedBy
      : (currentUser?.id ?? null);

  // Ordinary history inserts leave report_date NULL so multiple audit points
  // per calendar day remain allowed; daily reports use upsertDailyKpiReport.
  const row = await insertKpiHistory({
    kpi_id: kpiId,
    value,
    status: input.status,
    comment: input.comment?.trim() || null,
    recorded_at: recordedAt.toISOString(),
    report_date: null,
    recorded_by: recordedBy,
  });

  if (options?.syncCurrent !== false) {
    try {
      await syncCurrentKpiFromHistory({
        kpiId,
        value,
        status: input.status,
        recordedAt,
        existingNewestRecordedAt: prior?.recordedAt ?? null,
      });
    } catch {
      // Synk av aktuellt KPI-värde får inte blockera historikskrivningen.
    }
  }

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

/**
 * Atomic daily report for (kpi_id, report_date): upserts kpi_history and
 * updates kpis.current_value / status / updated_at via DB RPC.
 */
export async function upsertDailyKpiReport(
  input: UpsertDailyKpiReportInput,
  options?: { skipAudit?: boolean },
): Promise<KPIHistory> {
  const kpiId = input.kpiId.trim();
  if (!kpiId) {
    throw new Error("kpiId är obligatoriskt.");
  }

  const reportDate = input.reportDate.trim();
  if (!isValidReportDate(reportDate)) {
    throw new Error("reportDate måste vara YYYY-MM-DD.");
  }

  const value = input.value.trim();
  if (!value) {
    throw new Error("Värde är obligatoriskt.");
  }

  const kpi = await fetchKpiById(kpiId).catch(() => null);
  const currentUser = await getCurrentUser().catch(() => null);
  const recordedBy =
    input.recordedBy !== undefined
      ? input.recordedBy
      : (currentUser?.id ?? null);

  const row = await upsertDailyKpiReportRow({
    p_kpi_id: kpiId,
    p_report_date: reportDate,
    p_value: value,
    p_status: input.status,
    p_comment: input.comment?.trim() || null,
    p_recorded_by: recordedBy,
  });

  if (!options?.skipAudit) {
    try {
      const changes = collectFieldChanges(
        {
          current_value: kpi?.current_value ?? null,
          status: kpi?.status ?? null,
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
      // Audit runt daglig rapport får inte blockera sparandet.
    }
  }

  return mapKpiHistoryRow(row);
}

/** Alias for upsertDailyKpiReport — reserved for future reporting UI. */
export async function reportKpiForDate(
  input: UpsertDailyKpiReportInput,
  options?: { skipAudit?: boolean },
): Promise<KPIHistory> {
  return upsertDailyKpiReport(input, options);
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

/** KPI history rows recorded at/after cutoff (plus recent prior rows for diffs). */
export async function getKpiHistoryForChangeReport(
  cutoff: Date,
): Promise<KPIHistory[]> {
  try {
    const sinceRows = await fetchKpiHistorySince(cutoff.toISOString());
    if (sinceRows.length === 0) {
      return [];
    }
    const kpiIds = [...new Set(sinceRows.map((row) => row.kpi_id))];
    // Need previous points for status/value diffs.
    return await getRecentKpiHistoryForKpis(kpiIds, 4);
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
