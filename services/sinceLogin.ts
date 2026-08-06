import { formatDateTimeSv } from "@/lib/format/date";
import type { AuditLogListItem } from "@/services/auditLog";
import type { ActivityListItem } from "@/services/activities";
import type { DecisionListItem } from "@/services/decisions";
import type { GoalListItem } from "@/services/goals";
import type { KPIListItem } from "@/services/kpis";
import type { StatusTone } from "@/types";

export type SinceLoginTone = "red" | "yellow" | "blue" | "green" | "slate";

export type SinceLoginChange = {
  id: string;
  tone: SinceLoginTone;
  title: string;
  detail: string | null;
  occurredAt: string;
  occurredAtLabel: string;
  href: string;
  linkLabel: string;
};

type AreaRowLike = {
  id: string;
  name: string;
  slug: string;
  status: string;
  updated_at: string;
  created_at: string;
};

function isAfter(iso: string | null | undefined, cutoff: Date): boolean {
  if (!iso) {
    return false;
  }
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time >= cutoff.getTime();
}

function stockholmDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getSinceLoginCutoff(): Date {
  // Utan riktig auth: visa förändringar sedan midnatt (Stockholm).
  const day = stockholmDateKey(new Date());
  const probe = new Date(`${day}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm",
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(probe);
  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value;
  const match = offsetPart?.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  const hours = match ? Number(match[1]) : 1;
  const minutes = match?.[2] ? Number(match[2]) : 0;
  const sign = hours >= 0 ? "+" : "-";
  const absH = String(Math.abs(hours)).padStart(2, "0");
  const absM = String(Math.abs(minutes)).padStart(2, "0");
  return new Date(`${day}T00:00:00${sign}${absH}:${absM}`);
}

export function formatSinceLoginTime(iso: string): string {
  const date = new Date(iso);
  if (stockholmDateKey(date) === stockholmDateKey(new Date())) {
    const time = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Stockholm",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
    return `Idag ${time}`;
  }
  return formatDateTimeSv(iso);
}

function toneForStatus(status: StatusTone): SinceLoginTone {
  if (status === "Röd") {
    return "red";
  }
  if (status === "Gul") {
    return "yellow";
  }
  return "green";
}

function toneForAudit(entityType: string, action: string): SinceLoginTone {
  if (entityType === "activity" && action === "created") {
    return "blue";
  }
  if (entityType === "decision") {
    return "blue";
  }
  if (entityType === "goal") {
    return "green";
  }
  if (entityType === "business_area") {
    return "slate";
  }
  return "yellow";
}

function linkLabelForEntity(entityType: string): string {
  switch (entityType) {
    case "business_area":
      return "Öppna affärsområde";
    case "goal":
      return "Öppna mål";
    case "activity":
    case "activity_comment":
      return "Öppna aktivitet";
    case "decision":
      return "Öppna beslut";
    case "kpi":
      return "Öppna KPI";
    default:
      return "Öppna";
  }
}

export function buildSinceLoginChanges(input: {
  cutoff: Date;
  auditEntries: AuditLogListItem[];
  kpis: KPIListItem[];
  goals: GoalListItem[];
  activities: ActivityListItem[];
  decisions: DecisionListItem[];
  areas: AreaRowLike[];
  limit?: number;
}): SinceLoginChange[] {
  const limit = input.limit ?? 5;
  const areaNames = new Map(input.areas.map((area) => [area.id, area.name]));
  const areaSlugs = new Map(input.areas.map((area) => [area.id, area.slug]));
  const seen = new Set<string>();
  const items: SinceLoginChange[] = [];

  function push(item: SinceLoginChange, dedupeKey: string) {
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    items.push(item);
  }

  for (const entry of input.auditEntries) {
    if (!isAfter(entry.createdAt, input.cutoff)) {
      continue;
    }

    const areaName = entry.businessAreaId
      ? (areaNames.get(entry.businessAreaId) ?? null)
      : null;

    push(
      {
        id: `audit-${entry.id}`,
        tone: toneForAudit(entry.entityType, entry.action),
        title: entry.description,
        detail: areaName,
        occurredAt: entry.createdAt,
        occurredAtLabel: formatSinceLoginTime(entry.createdAt),
        href: entry.href ?? "/",
        linkLabel: linkLabelForEntity(entry.entityType),
      },
      `${entry.entityType}:${entry.entityId ?? entry.id}:${entry.action}`,
    );
  }

  for (const kpi of input.kpis) {
    if (!isAfter(kpi.updatedAt, input.cutoff)) {
      continue;
    }
    push(
      {
        id: `kpi-${kpi.id}`,
        tone: toneForStatus(kpi.status),
        title: `${kpi.name} ändrades till ${kpi.status}`,
        detail: kpi.businessAreaName,
        occurredAt: kpi.updatedAt,
        occurredAtLabel: formatSinceLoginTime(kpi.updatedAt),
        href: `/admin/kpis/${kpi.id}`,
        linkLabel: "Öppna KPI",
      },
      `kpi:${kpi.id}:updated`,
    );
  }

  for (const goal of input.goals) {
    if (goal.status !== "Grön" || !isAfter(goal.updatedAt, input.cutoff)) {
      continue;
    }
    push(
      {
        id: `goal-${goal.id}`,
        tone: "green",
        title: `Målet "${goal.title}" blev klart`,
        detail:
          areaNames.get(goal.businessAreaId) ?? goal.businessAreaName,
        occurredAt: goal.updatedAt,
        occurredAtLabel: formatSinceLoginTime(goal.updatedAt),
        href: `/admin/goals/${goal.id}`,
        linkLabel: "Öppna mål",
      },
      `goal:${goal.id}:completed`,
    );
  }

  for (const activity of input.activities) {
    if (isAfter(activity.createdAt, input.cutoff)) {
      push(
        {
          id: `activity-new-${activity.id}`,
          tone: "blue",
          title: `Ny aktivitet: ${activity.title}`,
          detail:
            areaNames.get(activity.businessAreaId) ??
            activity.businessAreaName,
          occurredAt: activity.createdAt,
          occurredAtLabel: formatSinceLoginTime(activity.createdAt),
          href: `/activities/${activity.id}`,
          linkLabel: "Öppna aktivitet",
        },
        `activity:${activity.id}:created`,
      );
    }

    if (
      activity.status === "Försenad" &&
      isAfter(activity.updatedAt, input.cutoff)
    ) {
      push(
        {
          id: `activity-delayed-${activity.id}`,
          tone: "red",
          title: `${activity.title} är försenad`,
          detail:
            areaNames.get(activity.businessAreaId) ??
            activity.businessAreaName,
          occurredAt: activity.updatedAt,
          occurredAtLabel: formatSinceLoginTime(activity.updatedAt),
          href: `/activities/${activity.id}`,
          linkLabel: "Öppna aktivitet",
        },
        `activity:${activity.id}:delayed`,
      );
    }
  }

  for (const decision of input.decisions) {
    if (!isAfter(decision.createdAt, input.cutoff)) {
      continue;
    }
    push(
      {
        id: `decision-${decision.id}`,
        tone: "blue",
        title: `Nytt beslut: ${decision.title}`,
        detail: decision.businessAreaName,
        occurredAt: decision.createdAt,
        occurredAtLabel: formatSinceLoginTime(decision.createdAt),
        href: `/admin/decisions/${decision.id}`,
        linkLabel: "Öppna beslut",
      },
      `decision:${decision.id}:created`,
    );
  }

  for (const area of input.areas) {
    if (!isAfter(area.updated_at, input.cutoff)) {
      continue;
    }
    // Hoppa över rena nyskapade om created ≈ updated (visa hellre via audit)
    const created = new Date(area.created_at).getTime();
    const updated = new Date(area.updated_at).getTime();
    if (Math.abs(updated - created) < 2000) {
      continue;
    }

    const status = area.status;
    push(
      {
        id: `area-${area.id}`,
        tone:
          status === "Röd"
            ? "red"
            : status === "Gul"
              ? "yellow"
              : status === "Grön"
                ? "green"
                : "slate",
        title: `${area.name} ändrade status till ${status}`,
        detail: area.name,
        occurredAt: area.updated_at,
        occurredAtLabel: formatSinceLoginTime(area.updated_at),
        href: `/areas/${areaSlugs.get(area.id) ?? area.slug}`,
        linkLabel: "Öppna affärsområde",
      },
      `business_area:${area.id}:status`,
    );
  }

  return items
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, limit);
}
