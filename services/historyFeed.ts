import type { AuditFieldChange } from "@/types";
import type { AuditLogListItem } from "@/services/auditLog";
import type { KPIHistory, VdDiaryEvent, VdDiaryTone } from "@/types";
import { historyRegisteredAt } from "@/lib/kpi/dailyReportDate";
import { formatSinceLoginTime } from "@/services/sinceLogin";

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  current_value: "Utfall",
  target_value: "Målvärde",
  archived_at: "Arkiverad",
  deadline: "Deadline",
  owner: "Ansvarig",
  manager: "Ansvarig",
  progress: "Progress",
  priority: "Prioritet",
  trend: "Trend",
  name: "Namn",
  title: "Titel",
  completed_at: "Slutförd",
  vd_comment: "VD-kommentar",
  description: "Beskrivning",
  category: "Kategori",
  unit: "Enhet",
  due_date: "Förfallodatum",
  meeting_date: "Mötesdatum",
  goal_kind: "Måltyp",
  lifecycle: "Tillstånd",
  kind: "Typ",
  ends_on: "Gäller till",
  body: "Text",
};

const DISPLAY_FIELDS = new Set([
  "status",
  "current_value",
  "target_value",
  "deadline",
  "owner",
  "manager",
  "progress",
  "priority",
  "trend",
  "completed_at",
  "due_date",
  "meeting_date",
  "vd_comment",
  "kind",
  "ends_on",
]);

function extractQuotedTitle(description: string): string | null {
  const match = description.match(/"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

function displayValue(value: string | null | undefined): string {
  const text = value?.trim();
  if (!text) {
    return "—";
  }
  return text;
}

function formatFieldChange(change: AuditFieldChange): string | null {
  if (!DISPLAY_FIELDS.has(change.field)) {
    return null;
  }
  // Never show opaque UUID area moves as "Affärsområde: uuid → uuid".
  if (change.field === "business_area_id") {
    return null;
  }
  const label = FIELD_LABELS[change.field] ?? change.field;
  return `${label}: ${displayValue(change.from)} → ${displayValue(change.to)}`;
}

export function formatAuditChangeSummary(
  fields: AuditFieldChange[] | null | undefined,
  limit = 2,
  options?: { currentValueLabel?: string },
): string | null {
  if (!fields?.length) {
    return null;
  }
  const currentValueLabel = options?.currentValueLabel ?? "Utfall";
  const parts = fields
    .map((change) => {
      if (!DISPLAY_FIELDS.has(change.field)) {
        return null;
      }
      if (change.field === "business_area_id") {
        return null;
      }
      const label =
        change.field === "current_value"
          ? currentValueLabel
          : (FIELD_LABELS[change.field] ?? change.field);
      return `${label}: ${displayValue(change.from)} → ${displayValue(change.to)}`;
    })
    .filter((part): part is string => Boolean(part))
    .slice(0, limit);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function isResultatName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("resultat") ||
    lower.includes("budget") ||
    lower.includes("prognos") ||
    lower.includes("marginal")
  );
}

function statusTone(value: string | null | undefined): VdDiaryTone | null {
  if (value === "Röd" || value === "Försenad") return "red";
  if (value === "Gul") return "yellow";
  if (value === "Grön" || value === "Klar" || value === "Klart") return "green";
  return null;
}

function toneFromFields(
  fields: AuditFieldChange[] | undefined,
  fallback: VdDiaryTone,
): VdDiaryTone {
  const status = fields?.find((field) => field.field === "status");
  return statusTone(status?.to) ?? fallback;
}

function auditHeadline(
  entityType: string,
  action: string,
  fields: AuditFieldChange[] | undefined,
  objectName: string,
): string {
  const statusTo = fields?.find((field) => field.field === "status")?.to ?? null;

  if (entityType === "kpi") {
    if (action === "created") return "KPI skapad";
    if (action === "history_recorded" || fields?.some((f) => f.field === "current_value")) {
      if (isResultatName(objectName)) return "Resultat uppdaterat";
    }
    if (isResultatName(objectName) && fields?.some((f) => f.field === "status" || f.field === "current_value")) {
      return "Resultat uppdaterat";
    }
    return "KPI uppdaterad";
  }

  if (entityType === "goal") {
    if (action === "created") return "Mål skapat";
    return "Mål uppdaterat";
  }

  if (entityType === "activity") {
    if (action === "created") return "Aktivitet skapad";
    if (statusTo === "Klar") return "Aktivitet slutförd";
    if (statusTo === "Försenad") return "Aktivitet försenad";
    return "Aktivitet uppdaterad";
  }

  if (entityType === "decision") {
    if (action === "created") return "Beslut skapat";
    if (action === "completed" || statusTo === "Klart") return "Beslut avslutat";
    return "Beslut uppdaterat";
  }

  if (entityType === "business_area") {
    if (action === "created") return "Affärsområde skapat";
    return "Affärsområde uppdaterat";
  }

  if (entityType === "activity_comment") {
    return "Kommentar tillagd";
  }

  if (entityType === "area_notice") {
    if (action === "created") return "Aktuellt skapat";
    const archived = fields?.find((field) => field.field === "archived_at");
    if (archived?.to) return "Aktuellt arkiverat";
    if (archived && !archived.to) return "Aktuellt återaktiverat";
    return "Aktuellt uppdaterat";
  }

  return "Händelse";
}

function defaultTone(entityType: string, action: string): VdDiaryTone {
  if (entityType === "kpi") return "yellow";
  if (entityType === "decision") {
    return action === "completed" ? "green" : "blue";
  }
  if (entityType === "goal") return "blue";
  if (entityType === "area_notice") {
    return action === "created" ? "blue" : "slate";
  }
  if (entityType === "activity") {
    return action === "created" ? "blue" : "slate";
  }
  return "slate";
}

/**
 * Builds a compact leadership revision feed from audit_log (+ KPI history diffs
 * only when a previous point exists so from→to is real, not invented).
 */
export function buildDashboardHistoryEvents(input: {
  auditEntries: AuditLogListItem[];
  kpiHistory: KPIHistory[];
  kpiMeta: Map<
    string,
    {
      name: string;
      area: string;
      owner: string;
      kind?: "TARGET" | "STATISTIC" | "CALCULATED";
      unit?: string | null;
    }
  >;
  goalTitles?: Map<string, string>;
  activityTitles?: Map<string, string>;
  decisionTitles?: Map<string, string>;
  areaNames: Map<string, string>;
  limit?: number;
}): VdDiaryEvent[] {
  const limit = input.limit ?? 5;
  const events: VdDiaryEvent[] = [];
  const coveredKpiKeys = new Set<string>();

  for (const entry of input.auditEntries ?? []) {
    if (entry.entityType === "activity_comment") {
      continue;
    }

    const fields = entry.changes?.fields ?? [];
    const kpiMetaForEntry =
      entry.entityType === "kpi" && entry.entityId
        ? input.kpiMeta.get(entry.entityId)
        : undefined;
    const changeSummary = formatAuditChangeSummary(fields, 2, {
      currentValueLabel:
        kpiMetaForEntry?.kind === "STATISTIC" ||
        kpiMetaForEntry?.kind === "CALCULATED"
          ? "Rapporterat värde"
          : "Utfall",
    });

    // Prefer concrete updates; still include creates without field diffs.
    if (
      entry.action !== "created" &&
      entry.action !== "completed" &&
      entry.action !== "commented" &&
      !changeSummary &&
      fields.length === 0
    ) {
      // Keep description-only updates only when description itself is specific.
      // Avoid empty generic rows.
      if (!extractQuotedTitle(entry.description)) {
        continue;
      }
    }

    let title =
      extractQuotedTitle(entry.description) ||
      (entry.entityType === "kpi" && entry.entityId
        ? input.kpiMeta.get(entry.entityId)?.name
        : null) ||
      (entry.entityType === "goal" && entry.entityId
        ? input.goalTitles?.get(entry.entityId)
        : null) ||
      (entry.entityType === "activity" && entry.entityId
        ? input.activityTitles?.get(entry.entityId)
        : null) ||
      (entry.entityType === "decision" && entry.entityId
        ? input.decisionTitles?.get(entry.entityId)
        : null) ||
      (entry.entityType === "business_area" && entry.entityId
        ? input.areaNames.get(entry.entityId)
        : null) ||
      "Objekt";

    if (entry.entityType === "kpi" && entry.entityId) {
      title = input.kpiMeta.get(entry.entityId)?.name ?? title;
      coveredKpiKeys.add(
        `${entry.entityId}:${entry.createdAt.slice(0, 16)}`,
      );
    }

    const areaFromKpi =
      entry.entityType === "kpi" && entry.entityId
        ? input.kpiMeta.get(entry.entityId)?.area
        : null;
    const area =
      areaFromKpi ||
      (entry.businessAreaId
        ? input.areaNames.get(entry.businessAreaId)
        : null) ||
      (entry.entityType === "business_area" && entry.entityId
        ? input.areaNames.get(entry.entityId)
        : null) ||
      "—";

    const headline = auditHeadline(
      entry.entityType,
      entry.action,
      fields,
      title,
    );

    events.push({
      id: `audit-${entry.id}`,
      tone: toneFromFields(fields, defaultTone(entry.entityType, entry.action)),
      headline,
      title,
      changeSummary,
      area,
      owner: entry.actorName?.trim() || "—",
      occurredAt: entry.createdAt,
      occurredAtLabel: formatSinceLoginTime(entry.createdAt),
      href: entry.href && entry.href !== "/" ? entry.href : null,
    });
  }

  // KPI history: only when previous point exists so from→to is factual.
  const byKpi = new Map<string, KPIHistory[]>();
  for (const row of input.kpiHistory ?? []) {
    const list = byKpi.get(row.kpiId) ?? [];
    list.push(row);
    byKpi.set(row.kpiId, list);
  }
  for (const [, list] of byKpi) {
    list.sort(
      (a, b) =>
        new Date(historyRegisteredAt(b)).getTime() -
        new Date(historyRegisteredAt(a)).getTime(),
    );
  }

  for (const [kpiId, list] of byKpi) {
    const latest = list[0];
    const previous = list[1];
    if (!latest || !previous) {
      continue;
    }

    const stampKey = `${kpiId}:${historyRegisteredAt(latest).slice(0, 16)}`;
    if (coveredKpiKeys.has(stampKey)) {
      continue;
    }

    const meta = input.kpiMeta.get(kpiId);
    const isStatistic =
      meta?.kind === "STATISTIC" || meta?.kind === "CALCULATED";
    const unitSuffix = meta?.unit?.trim() ? ` ${meta.unit.trim()}` : "";
    const parts: string[] = [];
    if (!isStatistic && previous.status !== latest.status) {
      parts.push(`Status: ${previous.status} → ${latest.status}`);
    }
    if (previous.value !== latest.value) {
      if (isStatistic) {
        parts.push(
          `Rapporterat värde: ${previous.value} → ${latest.value}${unitSuffix}`,
        );
      } else {
        parts.push(`Utfall: ${previous.value} → ${latest.value}`);
      }
    }
    if (parts.length === 0) {
      continue;
    }

    const name = meta?.name ?? "KPI";
    events.push({
      id: `kpi-history-${latest.id}`,
      tone: statusTone(latest.status) ?? "yellow",
      headline: isResultatName(name) ? "Resultat uppdaterat" : "KPI uppdaterad",
      title: name,
      changeSummary: parts.join(" · "),
      area: meta?.area ?? "—",
      owner: meta?.owner?.trim() || "—",
      occurredAt: historyRegisteredAt(latest),
      occurredAtLabel: formatSinceLoginTime(historyRegisteredAt(latest)),
      href: `/kpis/${kpiId}`,
    });
  }

  return events
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, limit);
}
