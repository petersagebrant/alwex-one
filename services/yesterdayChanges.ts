import type { AuditFieldChange } from "@/types";
import type { AuditLogListItem } from "@/services/auditLog";
import type { ActivityListItem } from "@/services/activities";
import type { GoalListItem } from "@/services/goals";
import type { KPIListItem } from "@/services/kpis";
import type { KPIHistory, StatusTone } from "@/types";
import {
  formatSinceLoginTime,
  getSinceLoginCutoff,
} from "@/services/sinceLogin";

export type YesterdayChangeTone = "red" | "yellow" | "green" | "blue" | "slate";

export type YesterdayChangeItem = {
  id: string;
  /** Compact one-line summary (assistant/context compatible). */
  text: string;
  tone: YesterdayChangeTone;
  /** Primary label shown with status color — usually business area. */
  area: string | null;
  /** What changed — the main readable sentence. */
  detail: string;
  owner: string | null;
  occurredAt: string;
  occurredAtLabel: string;
  href: string | null;
  priority: number;
};

type AreaRowLike = {
  id: string;
  name: string;
  slug: string;
  manager: string | null;
  status: string;
};

function isAfter(iso: string | null | undefined, cutoff: Date): boolean {
  if (!iso) {
    return false;
  }
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time >= cutoff.getTime();
}

/** Start of yesterday in Europe/Stockholm. */
export function getYesterdayCutoff(): Date {
  const todayMidnight = getSinceLoginCutoff();
  return new Date(todayMidnight.getTime() - 24 * 60 * 60 * 1000);
}

function cleanOwner(owner: string | null | undefined): string | null {
  const name = owner?.trim();
  if (!name || name === "Ej angiven") {
    return null;
  }
  return name;
}

function toStatus(value: string | null | undefined): StatusTone | null {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return null;
}

function toneForStatus(
  status: StatusTone | "Statistik" | string | null | undefined,
): YesterdayChangeTone {
  if (status === "Röd") return "red";
  if (status === "Gul") return "yellow";
  if (status === "Grön") return "green";
  return "slate";
}

function parseNumeric(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(value: string | null | undefined, unit?: string | null): string {
  const raw = value?.trim() || "—";
  if (!unit?.trim() || raw === "—") {
    return raw;
  }
  return `${raw} ${unit.trim()}`;
}

function fieldMap(fields: AuditFieldChange[] | undefined): Map<string, AuditFieldChange> {
  return new Map((fields ?? []).map((field) => [field.field, field]));
}

function isResultatKpi(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("resultat") ||
    lower.includes("budget") ||
    lower.includes("prognos") ||
    lower.includes("marginal")
  );
}

function significantValueChange(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  const a = parseNumeric(from);
  const b = parseNumeric(to);
  if (a === null || b === null) {
    return Boolean(from && to && from !== to);
  }
  if (a === 0) {
    return Math.abs(b) >= 1;
  }
  const pct = Math.abs((b - a) / Math.abs(a)) * 100;
  // Absolute unit change also counts for small percentages with large numbers.
  const abs = Math.abs(b - a);
  return pct >= 3 || abs >= 1;
}

function extractQuotedTitle(description: string): string | null {
  const match = description.match(/"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

/**
 * Deterministic VD change report since yesterday (no OpenAI).
 * Prioritizes KPI status/value, goals, activities, results-like KPIs, and areas.
 */
export function buildYesterdayChangeReport(input: {
  cutoff: Date;
  auditEntries: AuditLogListItem[];
  kpiHistory: KPIHistory[];
  kpis: KPIListItem[];
  goals: GoalListItem[];
  activities: ActivityListItem[];
  areas: AreaRowLike[];
  limit?: number;
}): YesterdayChangeItem[] {
  const limit = input.limit ?? 5;
  const areaById = new Map(
    input.areas.map((area) => [
      area.id,
      {
        name: area.name,
        slug: area.slug,
        manager: cleanOwner(area.manager),
      },
    ]),
  );
  const kpiById = new Map(input.kpis.map((kpi) => [kpi.id, kpi]));
  const goalById = new Map(input.goals.map((goal) => [goal.id, goal]));
  const activityById = new Map(
    input.activities.map((activity) => [activity.id, activity]),
  );

  const historyByKpi = new Map<string, KPIHistory[]>();
  for (const entry of input.kpiHistory) {
    const list = historyByKpi.get(entry.kpiId) ?? [];
    list.push(entry);
    historyByKpi.set(entry.kpiId, list);
  }
  for (const [, list] of historyByKpi) {
    list.sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
  }

  const items: YesterdayChangeItem[] = [];
  const seen = new Set<string>();

  function push(item: YesterdayChangeItem, dedupeKey: string) {
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    items.push(item);
  }

  // --- KPI history: status + material value changes ---
  for (const [kpiId, history] of historyByKpi) {
    const kpi = kpiById.get(kpiId);
    if (!kpi) continue;

    const latest = history[0];
    if (!latest || !isAfter(latest.recordedAt, input.cutoff)) {
      continue;
    }

    const previous =
      history.find(
        (entry) =>
          entry.id !== latest.id &&
          new Date(entry.recordedAt).getTime() <
            new Date(latest.recordedAt).getTime(),
      ) ?? null;

    const area = kpi.businessAreaName || null;
    const owner =
      cleanOwner(areaById.get(kpi.businessAreaId)?.manager) ?? null;
    const href = `/kpis/${kpi.id}`;
    const occurredAt = latest.recordedAt;
    const occurredAtLabel = formatSinceLoginTime(occurredAt);
    const resultatBoost = isResultatKpi(kpi.name) ? 5 : 0;

    if (previous && previous.status !== latest.status) {
      const to = latest.status;
      const from = previous.status;
      const detail = `${kpi.name} har gått från ${from.toLowerCase()} till ${to.toLowerCase()}.`;
      const priority =
        to === "Röd"
          ? 100
          : to === "Gul"
            ? 85
            : to === "Grön"
              ? 70
              : 50;
      push(
        {
          id: `kpi-status-${kpi.id}-${latest.id}`,
          text: `${area ?? "KPI"}: ${detail}`,
          tone: toneForStatus(to),
          area,
          detail,
          owner,
          occurredAt,
          occurredAtLabel,
          href,
          priority: priority + resultatBoost,
        },
        `kpi:${kpi.id}:status`,
      );
    }

    if (
      previous &&
      previous.value !== latest.value &&
      significantValueChange(previous.value, latest.value)
    ) {
      const fromLabel = formatValue(previous.value, kpi.unit);
      const toLabel = formatValue(latest.value, kpi.unit);
      const detail = `${kpi.name} har förändrats från ${fromLabel} till ${toLabel}.`;
      const worsened =
        previous.status === "Grön" && latest.status !== "Grön"
          ? 10
          : latest.status === "Röd"
            ? 8
            : 0;
      push(
        {
          id: `kpi-value-${kpi.id}-${latest.id}`,
          text: `${area ?? "KPI"}: ${detail}`,
          tone: toneForStatus(latest.status),
          area,
          detail,
          owner,
          occurredAt,
          occurredAtLabel,
          href,
          priority: 75 + resultatBoost + worsened,
        },
        `kpi:${kpi.id}:value`,
      );
    } else if (!previous) {
      // First history point in window — treat as update if status/value present.
      const detail = `${kpi.name} har uppdaterats (${latest.status.toLowerCase()}: ${formatValue(latest.value, kpi.unit)}).`;
      push(
        {
          id: `kpi-newhist-${kpi.id}-${latest.id}`,
          text: `${area ?? "KPI"}: ${detail}`,
          tone: toneForStatus(latest.status),
          area,
          detail,
          owner,
          occurredAt,
          occurredAtLabel,
          href,
          priority: 55 + resultatBoost,
        },
        `kpi:${kpi.id}:history`,
      );
    }
  }

  // --- Audit log: goals, activities, areas, KPI fallback, creates ---
  for (const entry of input.auditEntries) {
    if (!isAfter(entry.createdAt, input.cutoff)) {
      continue;
    }

    const fields = fieldMap(entry.changes?.fields);
    const areaMeta = entry.businessAreaId
      ? areaById.get(entry.businessAreaId)
      : undefined;
    const areaName = areaMeta?.name ?? null;
    const occurredAt = entry.createdAt;
    const occurredAtLabel = formatSinceLoginTime(occurredAt);

    if (entry.entityType === "kpi" && entry.entityId) {
      // Prefer history-derived KPI rows; only fill gaps via audit.
      if (seen.has(`kpi:${entry.entityId}:status`) || seen.has(`kpi:${entry.entityId}:value`)) {
        continue;
      }
      const kpi = kpiById.get(entry.entityId);
      const statusChange = fields.get("status");
      const valueChange = fields.get("current_value");
      if (!statusChange && !valueChange && entry.action !== "created") {
        continue;
      }

      const name =
        kpi?.name ?? extractQuotedTitle(entry.description) ?? "KPI";
      const area = kpi?.businessAreaName ?? areaName;
      const owner =
        cleanOwner(areaById.get(kpi?.businessAreaId ?? entry.businessAreaId ?? "")?.manager) ??
        null;
      const href = entry.href ?? `/kpis/${entry.entityId}`;

      if (entry.action === "created") {
        const detail = `Ny KPI: ${name}.`;
        push(
          {
            id: `audit-kpi-create-${entry.id}`,
            text: `${area ?? "KPI"}: ${detail}`,
            tone: toneForStatus(kpi?.status ?? null),
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 60 + (kpi && isResultatKpi(kpi.name) ? 5 : 0),
          },
          `kpi:${entry.entityId}:created`,
        );
        continue;
      }

      if (statusChange) {
        const to = toStatus(statusChange.to) ?? kpi?.status ?? null;
        const from = toStatus(statusChange.from);
        const detail = from
          ? `${name} har gått från ${from.toLowerCase()} till ${(to ?? "okänd").toLowerCase()}.`
          : `${name} har status ${to?.toLowerCase() ?? statusChange.to ?? "ändrad"}.`;
        push(
          {
            id: `audit-kpi-status-${entry.id}`,
            text: `${area ?? "KPI"}: ${detail}`,
            tone: toneForStatus(to),
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority:
              to === "Röd" ? 100 : to === "Gul" ? 85 : to === "Grön" ? 70 : 55,
          },
          `kpi:${entry.entityId}:status`,
        );
      } else if (
        valueChange &&
        significantValueChange(valueChange.from, valueChange.to)
      ) {
        const detail = `${name} har förändrats från ${formatValue(valueChange.from, kpi?.unit)} till ${formatValue(valueChange.to, kpi?.unit)}.`;
        push(
          {
            id: `audit-kpi-value-${entry.id}`,
            text: `${area ?? "KPI"}: ${detail}`,
            tone: toneForStatus(kpi?.status ?? null),
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 75 + (kpi && isResultatKpi(kpi.name) ? 5 : 0),
          },
          `kpi:${entry.entityId}:value`,
        );
      }
      continue;
    }

    if (entry.entityType === "goal" && entry.entityId) {
      const goal = goalById.get(entry.entityId);
      const title =
        goal?.title ?? extractQuotedTitle(entry.description) ?? "Mål";
      const area = goal?.businessAreaName ?? areaName;
      const owner = cleanOwner(goal?.owner) ?? cleanOwner(areaMeta?.manager);
      const href = entry.href ?? `/admin/goals/${entry.entityId}`;

      if (entry.action === "created") {
        const detail = `Nytt mål: ${title}.`;
        push(
          {
            id: `audit-goal-create-${entry.id}`,
            text: `${area ?? "Mål"}: ${detail}`,
            tone: "blue",
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 65,
          },
          `goal:${entry.entityId}:created`,
        );
        continue;
      }

      const statusChange = fields.get("status");
      const targetChange = fields.get("target_value");
      const deadlineChange = fields.get("deadline");
      const currentChange = fields.get("current_value");

      if (statusChange) {
        const to = toStatus(statusChange.to);
        const from = toStatus(statusChange.from);
        const detail = from
          ? `Målet "${title}" har gått från ${from.toLowerCase()} till ${(to ?? statusChange.to ?? "okänd").toLowerCase()}.`
          : `Målet "${title}" har status ${(to ?? statusChange.to ?? "ändrad").toLowerCase()}.`;
        push(
          {
            id: `audit-goal-status-${entry.id}`,
            text: `${area ?? "Mål"}: ${detail}`,
            tone: toneForStatus(to),
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: to === "Röd" ? 90 : to === "Gul" ? 72 : 68,
          },
          `goal:${entry.entityId}:status`,
        );
      } else if (targetChange) {
        const detail = `Målvärde för "${title}" ändrat från ${targetChange.from ?? "—"} till ${targetChange.to ?? "—"}.`;
        push(
          {
            id: `audit-goal-target-${entry.id}`,
            text: `${area ?? "Mål"}: ${detail}`,
            tone: "slate",
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 62,
          },
          `goal:${entry.entityId}:target`,
        );
      } else if (deadlineChange) {
        const detail = `Deadline för "${title}" ändrad från ${deadlineChange.from ?? "—"} till ${deadlineChange.to ?? "—"}.`;
        push(
          {
            id: `audit-goal-deadline-${entry.id}`,
            text: `${area ?? "Mål"}: ${detail}`,
            tone: "yellow",
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 64,
          },
          `goal:${entry.entityId}:deadline`,
        );
      } else if (
        currentChange &&
        significantValueChange(currentChange.from, currentChange.to)
      ) {
        const detail = `Utfall för "${title}" ändrat från ${currentChange.from ?? "—"} till ${currentChange.to ?? "—"}.`;
        push(
          {
            id: `audit-goal-current-${entry.id}`,
            text: `${area ?? "Mål"}: ${detail}`,
            tone: toneForStatus(goal?.status ?? null),
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 63,
          },
          `goal:${entry.entityId}:current`,
        );
      }
      continue;
    }

    if (entry.entityType === "activity" && entry.entityId) {
      const activity = activityById.get(entry.entityId);
      const title =
        activity?.title ?? extractQuotedTitle(entry.description) ?? "Aktivitet";
      const area = activity?.businessAreaName ?? areaName;
      const owner =
        cleanOwner(activity?.owner) ?? cleanOwner(areaMeta?.manager);
      const href = entry.href ?? `/activities/${entry.entityId}`;
      const statusChange = fields.get("status");
      const ownerChange = fields.get("owner");
      const deadlineChange = fields.get("deadline");

      if (entry.action === "created") {
        const detail = `Ny aktivitet: ${title}.`;
        push(
          {
            id: `audit-activity-create-${entry.id}`,
            text: `${area ?? "Aktivitet"}: ${detail}`,
            tone: "blue",
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 58,
          },
          `activity:${entry.entityId}:created`,
        );
        continue;
      }

      const toStatusValue = statusChange?.to ?? null;
      if (toStatusValue === "Försenad") {
        const detail = `Aktiviteten "${title}" har blivit försenad.`;
        push(
          {
            id: `audit-activity-delayed-${entry.id}`,
            text: `${area ?? "Aktivitet"}: ${detail}`,
            tone: "red",
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 95,
          },
          `activity:${entry.entityId}:delayed`,
        );
      } else if (toStatusValue === "Klar") {
        const detail = `Aktiviteten "${title}" har slutförts.`;
        push(
          {
            id: `audit-activity-done-${entry.id}`,
            text: `${area ?? "Aktivitet"}: ${detail}`,
            tone: "green",
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 66,
          },
          `activity:${entry.entityId}:done`,
        );
      } else if (ownerChange) {
        const detail = `Ansvarig för "${title}" ändrad från ${ownerChange.from ?? "—"} till ${ownerChange.to ?? "—"}.`;
        push(
          {
            id: `audit-activity-owner-${entry.id}`,
            text: `${area ?? "Aktivitet"}: ${detail}`,
            tone: "slate",
            area,
            detail,
            owner: cleanOwner(ownerChange.to) ?? owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 50,
          },
          `activity:${entry.entityId}:owner`,
        );
      } else if (deadlineChange) {
        const detail = `Deadline för "${title}" ändrad från ${deadlineChange.from ?? "—"} till ${deadlineChange.to ?? "—"}.`;
        push(
          {
            id: `audit-activity-deadline-${entry.id}`,
            text: `${area ?? "Aktivitet"}: ${detail}`,
            tone: "yellow",
            area,
            detail,
            owner,
            occurredAt,
            occurredAtLabel,
            href,
            priority: 56,
          },
          `activity:${entry.entityId}:deadline`,
        );
      }
      continue;
    }

    if (entry.entityType === "business_area" && entry.entityId) {
      const area = areaById.get(entry.entityId);
      const name = area?.name ?? extractQuotedTitle(entry.description) ?? "Affärsområde";
      const statusChange = fields.get("status");
      const managerChange = fields.get("manager");
      const href = entry.href ?? `/areas/${area?.slug ?? ""}`;

      if (statusChange) {
        const to = toStatus(statusChange.to);
        const from = toStatus(statusChange.from);
        const detail = from
          ? `Affärsområdet har gått från ${from.toLowerCase()} till ${(to ?? statusChange.to ?? "okänd").toLowerCase()}.`
          : `Affärsområdet har status ${(to ?? statusChange.to ?? "ändrad").toLowerCase()}.`;
        push(
          {
            id: `audit-area-status-${entry.id}`,
            text: `${name}: ${detail}`,
            tone: toneForStatus(to),
            area: name,
            detail,
            owner: cleanOwner(area?.manager),
            occurredAt,
            occurredAtLabel,
            href: href || "/areas",
            priority: to === "Röd" ? 92 : to === "Gul" ? 74 : 60,
          },
          `area:${entry.entityId}:status`,
        );
      } else if (managerChange) {
        const detail = `Ansvarig ändrad från ${managerChange.from ?? "—"} till ${managerChange.to ?? "—"}.`;
        push(
          {
            id: `audit-area-manager-${entry.id}`,
            text: `${name}: ${detail}`,
            tone: "slate",
            area: name,
            detail,
            owner: cleanOwner(managerChange.to),
            occurredAt,
            occurredAtLabel,
            href: href || "/areas",
            priority: 48,
          },
          `area:${entry.entityId}:manager`,
        );
      }
    }
  }

  // Entity fallbacks when audit is sparse but timestamps moved (activities delayed etc.)
  for (const activity of input.activities) {
    if (
      activity.status === "Försenad" &&
      isAfter(activity.updatedAt, input.cutoff) &&
      !seen.has(`activity:${activity.id}:delayed`)
    ) {
      const detail = `Aktiviteten "${activity.title}" har blivit försenad.`;
      push(
        {
          id: `activity-delayed-${activity.id}`,
          text: `${activity.businessAreaName}: ${detail}`,
          tone: "red",
          area: activity.businessAreaName,
          detail,
          owner: cleanOwner(activity.owner),
          occurredAt: activity.updatedAt,
          occurredAtLabel: formatSinceLoginTime(activity.updatedAt),
          href: `/activities/${activity.id}`,
          priority: 94,
        },
        `activity:${activity.id}:delayed`,
      );
    }

    if (
      activity.status === "Klar" &&
      isAfter(activity.updatedAt, input.cutoff) &&
      !seen.has(`activity:${activity.id}:done`)
    ) {
      const detail = `Aktiviteten "${activity.title}" har slutförts.`;
      push(
        {
          id: `activity-done-${activity.id}`,
          text: `${activity.businessAreaName}: ${detail}`,
          tone: "green",
          area: activity.businessAreaName,
          detail,
          owner: cleanOwner(activity.owner),
          occurredAt: activity.updatedAt,
          occurredAtLabel: formatSinceLoginTime(activity.updatedAt),
          href: `/activities/${activity.id}`,
          priority: 65,
        },
        `activity:${activity.id}:done`,
      );
    }

    if (
      isAfter(activity.createdAt, input.cutoff) &&
      !seen.has(`activity:${activity.id}:created`)
    ) {
      const detail = `Ny aktivitet: ${activity.title}.`;
      push(
        {
          id: `activity-new-${activity.id}`,
          text: `${activity.businessAreaName}: ${detail}`,
          tone: "blue",
          area: activity.businessAreaName,
          detail,
          owner: cleanOwner(activity.owner),
          occurredAt: activity.createdAt,
          occurredAtLabel: formatSinceLoginTime(activity.createdAt),
          href: `/activities/${activity.id}`,
          priority: 57,
        },
        `activity:${activity.id}:created`,
      );
    }
  }

  for (const goal of input.goals) {
    if (
      isAfter(goal.createdAt, input.cutoff) &&
      !seen.has(`goal:${goal.id}:created`)
    ) {
      const detail = `Nytt mål: ${goal.title}.`;
      push(
        {
          id: `goal-new-${goal.id}`,
          text: `${goal.businessAreaName}: ${detail}`,
          tone: "blue",
          area: goal.businessAreaName,
          detail,
          owner: cleanOwner(goal.owner),
          occurredAt: goal.createdAt,
          occurredAtLabel: formatSinceLoginTime(goal.createdAt),
          href: `/admin/goals/${goal.id}`,
          priority: 64,
        },
        `goal:${goal.id}:created`,
      );
    }
  }

  return items
    .sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return (
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
    })
    .slice(0, limit);
}
