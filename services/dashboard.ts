import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import { getActivities, type ActivityListItem } from "@/services/activities";
import { getAllActivityComments } from "@/services/activityComments";
import {
  getRecentAuditLog,
  type AuditLogListItem,
} from "@/services/auditLog";
import { getDecisions } from "@/services/decisions";
import { getGoals } from "@/services/goals";
import { getKPIs } from "@/services/kpis";
import {
  getKpiHistoryChangeLinesSince,
  getRecentKpiHistoryEntries,
} from "@/services/kpiHistory";
import {
  buildSinceLoginChanges,
  formatSinceLoginTime,
  getSinceLoginCutoff,
  type SinceLoginChange,
} from "@/services/sinceLogin";
import type { StatusTone, VdDiaryEvent, VdDiaryTone } from "@/types";

export type DashboardKpi = {
  id: string;
  label: string;
  value: string;
  status: StatusTone;
};

export type DashboardArea = {
  id: string;
  slug: string;
  name: string;
  manager: string;
  status: StatusTone;
  goalCount: number;
  activityCount: number;
  delayedActivityCount: number;
  comment: string;
};

export type DashboardAttentionItem = {
  id: string;
  title: string;
  detail: string;
  slug: string;
};

export type DashboardActionGoal = {
  id: string;
  goal: string;
  area: string;
  owner: string;
  deadline: string;
  status: StatusTone;
};

export type DashboardDecisionItem = {
  id: string;
  title: string;
  detail: string;
};

export type DashboardRecentEvent = {
  id: string;
  createdAt: string;
  actorName: string;
  description: string;
  href: string | null;
};

export type DashboardVdFocusTone = "red" | "yellow" | "green";

export type DashboardVdFocusKpi = {
  id: string;
  name: string;
  area: string;
  status: StatusTone;
  trend: string;
  owner: string;
  href: string;
};

export type DashboardVdFocusActivity = {
  id: string;
  title: string;
  area: string;
  owner: string;
  deadline: string;
  href: string;
};

export type DashboardVdFocusDecision = {
  id: string;
  title: string;
  area: string;
  owner: string;
  dueDate: string;
  href: string;
};

export type DashboardVdFocus = {
  cardTone: DashboardVdFocusTone;
  summary: {
    kpiFollowUpCount: number;
    delayedActivityCount: number;
    openDecisionCount: number;
    redAreaCount: number;
  };
  kpis: DashboardVdFocusKpi[];
  delayedActivities: DashboardVdFocusActivity[];
  openDecisions: DashboardVdFocusDecision[];
};

export type DashboardVdAssistantRisk = "Låg" | "Medel" | "Hög";

export type DashboardVdAssistant = {
  greeting: string;
  intro: string;
  highlights: string[];
  recommendation: string;
  riskLevel: DashboardVdAssistantRisk;
  riskLabel: string;
  analyzedAtLabel: string;
};

export type DashboardYesterdayChange = {
  id: string;
  text: string;
};

export type DashboardData = {
  kpis: DashboardKpi[];
  businessAreas: DashboardArea[];
  attentionItems: DashboardAttentionItem[];
  actionGoals: DashboardActionGoal[];
  upcomingDecisions: DashboardDecisionItem[];
  recentEvents: DashboardRecentEvent[];
  historyEvents: VdDiaryEvent[];
  vdFocus: DashboardVdFocus;
  sinceLoginChanges: SinceLoginChange[];
  vdAssistant: DashboardVdAssistant;
  yesterdayChanges: DashboardYesterdayChange[];
};

function toStatusTone(value: string): StatusTone {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return "Gul";
}

function countStatus(count: number, zeroTone: StatusTone = "Gul"): StatusTone {
  return count > 0 ? "Grön" : zeroTone;
}

function swedishCountPhrase(
  count: number,
  one: string,
  many: string,
  none: string,
): string {
  if (count <= 0) {
    return none;
  }
  if (count === 1) {
    return one;
  }
  return many.replace("{n}", String(count));
}

function getYesterdayCutoff(): Date {
  const todayMidnight = getSinceLoginCutoff();
  return new Date(todayMidnight.getTime() - 24 * 60 * 60 * 1000);
}

function isAfter(iso: string | null | undefined, cutoff: Date): boolean {
  if (!iso) {
    return false;
  }
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time >= cutoff.getTime();
}

function todayDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isDelayedActivity(activity: ActivityListItem): boolean {
  if (activity.status === "Försenad") {
    return true;
  }
  if (activity.status === "Klar" || !activity.deadline) {
    return false;
  }

  const deadlineKey = activity.deadline.slice(0, 10);
  return deadlineKey < todayDateKey();
}

function extractQuotedTitle(description: string): string {
  const match = description.match(/"([^"]+)"/);
  return match?.[1]?.trim() || description.trim() || "Händelse";
}

function auditHeadline(entityType: string, action: string): string {
  if (entityType === "kpi") {
    if (action === "created") return "Ny KPI";
    return "KPI ändrad";
  }
  if (entityType === "goal") {
    if (action === "created") return "Nytt mål";
    return "Mål uppdaterat";
  }
  if (entityType === "activity") {
    if (action === "created") return "Ny aktivitet";
    if (action === "commented") return "Ny kommentar";
    return "Aktivitet uppdaterad";
  }
  if (entityType === "decision") {
    if (action === "created") return "Nytt beslut";
    if (action === "completed") return "Beslut avslutat";
    return "Beslut uppdaterat";
  }
  if (entityType === "business_area") {
    if (action === "created") return "Nytt affärsområde";
    return "Affärsområde uppdaterat";
  }
  if (entityType === "activity_comment") {
    return "Ny kommentar";
  }
  return "Händelse";
}

function auditTone(entityType: string, action: string): VdDiaryTone {
  if (entityType === "kpi") {
    return "yellow";
  }
  if (entityType === "decision") {
    return action === "completed" ? "green" : "blue";
  }
  if (entityType === "goal") {
    return "green";
  }
  if (entityType === "activity") {
    return action === "created" ? "blue" : "slate";
  }
  if (entityType === "business_area") {
    return "slate";
  }
  return "slate";
}

function statusToneToDiary(status: StatusTone): VdDiaryTone {
  if (status === "Röd") return "red";
  if (status === "Gul") return "yellow";
  return "green";
}

function buildHistoryEvents(input: {
  auditEntries: AuditLogListItem[];
  kpiHistory: Awaited<ReturnType<typeof getRecentKpiHistoryEntries>>;
  kpiMeta: Map<
    string,
    { name: string; area: string; owner: string }
  >;
  areaNames: Map<string, string>;
  limit: number;
}): VdDiaryEvent[] {
  const fromAudit: VdDiaryEvent[] = (input.auditEntries ?? []).map((entry) => ({
    id: `audit-${entry.id}`,
    tone: auditTone(entry.entityType, entry.action),
    headline: auditHeadline(entry.entityType, entry.action),
    title: extractQuotedTitle(entry.description),
    area: entry.businessAreaId
      ? (input.areaNames.get(entry.businessAreaId) ?? "—")
      : "—",
    owner: entry.actorName || "Ej angiven",
    occurredAt: entry.createdAt,
    occurredAtLabel: formatSinceLoginTime(entry.createdAt),
    href: entry.href || "/",
  }));

  const fromKpiHistory: VdDiaryEvent[] = (input.kpiHistory ?? []).map(
    (entry) => {
      const meta = input.kpiMeta.get(entry.kpiId);
      return {
        id: `kpi-history-${entry.id}`,
        tone: statusToneToDiary(entry.status),
        headline: "KPI-historik",
        title: meta?.name ?? "KPI",
        area: meta?.area ?? "—",
        owner: meta?.owner ?? "Ej angiven",
        occurredAt: entry.recordedAt || entry.createdAt,
        occurredAtLabel: formatSinceLoginTime(
          entry.recordedAt || entry.createdAt,
        ),
        href: `/admin/kpis/${entry.kpiId}`,
      };
    },
  );

  return [...fromAudit, ...fromKpiHistory]
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, input.limit);
}

function buildYesterdayChanges(input: {
  newActivityCount: number;
  changedKpiCount: number;
  closedDecisionCount: number;
  newGoalCount: number;
  statusChangeCount: number;
  kpiHistoryLines: { id: string; text: string }[];
}): DashboardYesterdayChange[] {
  const changes: DashboardYesterdayChange[] = [];

  if (input.newActivityCount > 0) {
    changes.push({
      id: "yesterday-new-activities",
      text: swedishCountPhrase(
        input.newActivityCount,
        "1 ny aktivitet",
        "{n} nya aktiviteter",
        "",
      ),
    });
  }

  if (input.changedKpiCount > 0) {
    changes.push({
      id: "yesterday-changed-kpis",
      text: swedishCountPhrase(
        input.changedKpiCount,
        "1 ändrad KPI",
        "{n} ändrade KPI",
        "",
      ),
    });
  }

  if (input.closedDecisionCount > 0) {
    changes.push({
      id: "yesterday-closed-decisions",
      text: swedishCountPhrase(
        input.closedDecisionCount,
        "1 avslutat beslut",
        "{n} avslutade beslut",
        "",
      ),
    });
  }

  if (input.newGoalCount > 0) {
    changes.push({
      id: "yesterday-new-goals",
      text: swedishCountPhrase(
        input.newGoalCount,
        "1 nytt mål",
        "{n} nya mål",
        "",
      ),
    });
  }

  if (input.statusChangeCount > 0) {
    changes.push({
      id: "yesterday-status-changes",
      text: swedishCountPhrase(
        input.statusChangeCount,
        "1 statusförändring",
        "{n} statusförändringar",
        "",
      ),
    });
  }

  for (const line of input.kpiHistoryLines.slice(0, 3)) {
    if (changes.some((change) => change.text === line.text)) {
      continue;
    }
    changes.push(line);
  }

  return changes;
}

function buildVdAssistant(input: {
  kpiFollowUpCount: number;
  delayedCount: number;
  redAreaCount: number;
  openDecisionCount: number;
  yellowAreaNames: string[];
  redAreaNames: string[];
  topFollowUpKpi: { name: string; owner: string; status: StatusTone } | null;
  topDelayedActivity: { title: string; owner: string } | null;
}): DashboardVdAssistant {
  const nulage = [
    swedishCountPhrase(
      input.kpiFollowUpCount,
      "1 KPI behöver följas upp",
      "{n} KPI behöver följas upp",
      "inga KPI behöver följas upp",
    ),
    swedishCountPhrase(
      input.delayedCount,
      "1 aktivitet är försenad",
      "{n} aktiviteter är försenade",
      "inga försenade aktiviteter",
    ),
    swedishCountPhrase(
      input.openDecisionCount,
      "1 öppet beslut",
      "{n} öppna beslut",
      "inga öppna beslut",
    ),
  ].join(", ");

  let deviation: string;
  if (input.redAreaNames.length > 0) {
    deviation = `${input.redAreaNames[0]} har röd status.`;
  } else if (input.topFollowUpKpi?.status === "Röd") {
    deviation = `KPI:n ${input.topFollowUpKpi.name} är röd och kräver omedelbar uppföljning.`;
  } else if (input.topDelayedActivity) {
    deviation = `Aktiviteten "${input.topDelayedActivity.title}" är försenad.`;
  } else if (input.topFollowUpKpi) {
    deviation = `KPI:n ${input.topFollowUpKpi.name} är gul och bör följas upp.`;
  } else if (input.yellowAreaNames.length > 0) {
    deviation = `${input.yellowAreaNames[0]} har gul status.`;
  } else {
    deviation = "Inga kritiska avvikelser just nu.";
  }

  let recommendation: string;
  if (input.topFollowUpKpi) {
    recommendation = `Prioritet idag: följ upp KPI:n ${input.topFollowUpKpi.name} tillsammans med ${input.topFollowUpKpi.owner}.`;
  } else if (input.topDelayedActivity) {
    recommendation = `Prioritet idag: säkra nästa steg för "${input.topDelayedActivity.title}" med ${input.topDelayedActivity.owner}.`;
  } else if (input.openDecisionCount > 0) {
    recommendation =
      "Prioritet idag: driva de öppna besluten framåt så att de inte ligger still.";
  } else if (input.redAreaCount > 0) {
    recommendation =
      "Prioritet idag: gå igenom affärsområden med röd status och säkra åtgärdsplan.";
  } else {
    recommendation =
      "Prioritet idag: behåll den dagliga översikten och följ upp eventuella gulmarkeringar i tid.";
  }

  let riskLevel: DashboardVdAssistantRisk = "Låg";
  if (
    input.redAreaCount > 0 ||
    input.delayedCount >= 2 ||
    input.topFollowUpKpi?.status === "Röd"
  ) {
    riskLevel = "Hög";
  } else if (input.kpiFollowUpCount > 0 || input.delayedCount > 0) {
    riskLevel = "Medel";
  }

  return {
    greeting: "God morgon Peter.",
    intro: "Här är min sammanfattning av läget just nu.",
    highlights: [`Nuläge: ${nulage}.`, `Viktigaste avvikelse: ${deviation}`],
    recommendation,
    riskLevel,
    riskLabel: riskLevel,
    analyzedAtLabel: formatDateTimeSv(new Date().toISOString()),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const [
    areaRows,
    goals,
    activities,
    comments,
    allDecisions,
    recentAudit,
    allKpis,
    recentKpiHistory,
  ] = await Promise.all([
    fetchBusinessAreas().catch(() => []),
    getGoals().catch(() => []),
    getActivities().catch(() => []),
    getAllActivityComments().catch(() => []),
    getDecisions().catch(() => []),
    getRecentAuditLog(40).catch(() => []),
    getKPIs().catch(() => []),
    getRecentKpiHistoryEntries(40).catch(() => []),
  ]);

  const openDecisions = (allDecisions ?? [])
    .filter((decision) => decision.status !== "Klart")
    .sort((a, b) => {
      const aDate = a.dueDate ?? a.meetingDate ?? "9999-12-31";
      const bDate = b.dueDate ?? b.meetingDate ?? "9999-12-31";
      return aDate.localeCompare(bDate);
    });
  const upcoming = openDecisions.slice(0, 5);

  const completedGoals = (goals ?? []).filter((goal) => goal.status === "Grön");
  const ongoingActivities = (activities ?? []).filter(
    (activity) => activity.status === "Pågår",
  );
  const delayedActivities = (activities ?? []).filter(isDelayedActivity);

  const areaNames = new Map(
    (areaRows ?? []).map((area) => [area.id, area.name]),
  );
  const activityAreaMap = new Map(
    (activities ?? []).map((activity) => [
      activity.id,
      activity.businessAreaId,
    ]),
  );

  const goalsByArea = new Map<string, number>();
  for (const goal of goals ?? []) {
    goalsByArea.set(
      goal.businessAreaId,
      (goalsByArea.get(goal.businessAreaId) ?? 0) + 1,
    );
  }

  const activitiesByArea = new Map<string, number>();
  const delayedByArea = new Map<string, number>();
  for (const activity of activities ?? []) {
    activitiesByArea.set(
      activity.businessAreaId,
      (activitiesByArea.get(activity.businessAreaId) ?? 0) + 1,
    );
    if (isDelayedActivity(activity)) {
      delayedByArea.set(
        activity.businessAreaId,
        (delayedByArea.get(activity.businessAreaId) ?? 0) + 1,
      );
    }
  }

  const latestCommentByArea = new Map<string, string>();
  for (const comment of comments ?? []) {
    const areaId = activityAreaMap.get(comment.activityId);
    if (!areaId || latestCommentByArea.has(areaId)) {
      continue;
    }
    const content = comment.content.trim();
    if (content) {
      latestCommentByArea.set(areaId, content);
    }
  }

  const redGoalsByArea = new Map<string, number>();
  for (const goal of goals ?? []) {
    if (goal.status !== "Röd") {
      continue;
    }
    redGoalsByArea.set(
      goal.businessAreaId,
      (redGoalsByArea.get(goal.businessAreaId) ?? 0) + 1,
    );
  }

  const attentionItems: DashboardAttentionItem[] = (areaRows ?? [])
    .filter(
      (area) =>
        (redGoalsByArea.get(area.id) ?? 0) > 0 ||
        (delayedByArea.get(area.id) ?? 0) > 0,
    )
    .map((area) => {
      const redCount = redGoalsByArea.get(area.id) ?? 0;
      const delayedCountForArea = delayedByArea.get(area.id) ?? 0;
      const reasons: string[] = [];

      if (redCount > 0) {
        reasons.push(
          redCount === 1 ? "1 rött mål" : `${redCount} röda mål`,
        );
      }
      if (delayedCountForArea > 0) {
        reasons.push(
          delayedCountForArea === 1
            ? "1 försenad aktivitet"
            : `${delayedCountForArea} försenade aktiviteter`,
        );
      }

      return {
        id: area.id,
        title: area.name,
        detail: reasons.join(" · "),
        slug: area.slug,
      };
    });

  const actionGoals: DashboardActionGoal[] = (goals ?? [])
    .filter((goal) => goal.status === "Röd" || goal.status === "Gul")
    .map((goal) => ({
      id: goal.id,
      goal: goal.title,
      area: areaNames.get(goal.businessAreaId) ?? goal.businessAreaName,
      owner: goal.owner ?? "Ej angiven",
      deadline: goal.deadline ?? "—",
      status: goal.status,
    }));

  const businessAreaCount = (areaRows ?? []).length;
  const goalCount = (goals ?? []).length;
  const activityCount = (activities ?? []).length;
  const completedGoalCount = completedGoals.length;
  const ongoingActivityCount = ongoingActivities.length;
  const delayedCount = delayedActivities.length;
  const areasWithRedGoalsCount = redGoalsByArea.size;

  const areaManagers = new Map(
    (areaRows ?? []).map((area) => [area.id, area.manager ?? "Ej angiven"]),
  );

  const followUpKpis = (allKpis ?? []).filter(
    (kpi) => kpi.status === "Gul" || kpi.status === "Röd",
  );
  const redAreaRows = (areaRows ?? []).filter(
    (area) => toStatusTone(area.status) === "Röd",
  );
  const yellowAreaRows = (areaRows ?? []).filter(
    (area) => toStatusTone(area.status) === "Gul",
  );
  const redAreaCount = redAreaRows.length;
  const waitingDecisionCount = openDecisions.length;

  const hasCritical =
    delayedCount > 0 ||
    followUpKpis.some((kpi) => kpi.status === "Röd") ||
    redAreaCount > 0;
  const hasFollowUp =
    followUpKpis.some((kpi) => kpi.status === "Gul") ||
    waitingDecisionCount > 0;

  const topFollowUpKpi =
    followUpKpis.find((kpi) => kpi.status === "Röd") ??
    followUpKpis[0] ??
    null;
  const topDelayedActivity = delayedActivities[0] ?? null;

  const vdAssistant = buildVdAssistant({
    kpiFollowUpCount: followUpKpis.length,
    delayedCount,
    redAreaCount,
    openDecisionCount: waitingDecisionCount,
    yellowAreaNames: yellowAreaRows.map((area) => area.name),
    redAreaNames: redAreaRows.map((area) => area.name),
    topFollowUpKpi: topFollowUpKpi
      ? {
          name: topFollowUpKpi.name,
          owner:
            areaManagers.get(topFollowUpKpi.businessAreaId) ?? "ansvarig",
          status: topFollowUpKpi.status,
        }
      : null,
    topDelayedActivity: topDelayedActivity
      ? {
          title: topDelayedActivity.title,
          owner: topDelayedActivity.owner ?? "ansvarig",
        }
      : null,
  });

  const vdFocus: DashboardVdFocus = {
    cardTone: hasCritical ? "red" : hasFollowUp ? "yellow" : "green",
    summary: {
      kpiFollowUpCount: followUpKpis.length,
      delayedActivityCount: delayedCount,
      openDecisionCount: waitingDecisionCount,
      redAreaCount,
    },
    kpis: followUpKpis.map((kpi) => ({
      id: kpi.id,
      name: kpi.name,
      area: kpi.businessAreaName,
      status: kpi.status,
      trend: kpi.trend,
      owner: areaManagers.get(kpi.businessAreaId) ?? "Ej angiven",
      href: `/admin/kpis/${kpi.id}`,
    })),
    delayedActivities: delayedActivities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      area: areaNames.get(activity.businessAreaId) ?? "Okänt område",
      owner: activity.owner ?? "Ej angiven",
      deadline: activity.deadline
        ? formatDateSv(activity.deadline)
        : "—",
      href: `/activities/${activity.id}`,
    })),
    openDecisions: openDecisions.map((decision) => ({
      id: decision.id,
      title: decision.title,
      area: decision.businessAreaName,
      owner: decision.owner ?? "Ej angiven",
      dueDate: decision.dueDate ? formatDateSv(decision.dueDate) : "—",
      href: `/admin/decisions/${decision.id}`,
    })),
  };

  const sinceLoginChanges = buildSinceLoginChanges({
    cutoff: getSinceLoginCutoff(),
    auditEntries: recentAudit ?? [],
    kpis: allKpis ?? [],
    goals: goals ?? [],
    activities: activities ?? [],
    decisions: allDecisions ?? [],
    areas: areaRows ?? [],
    limit: 5,
  });

  const yesterdayCutoff = getYesterdayCutoff();
  const kpiNames = new Map(
    (allKpis ?? []).map((kpi) => [kpi.id, kpi.name]),
  );
  const kpiMeta = new Map(
    (allKpis ?? []).map((kpi) => [
      kpi.id,
      {
        name: kpi.name,
        area: kpi.businessAreaName,
        owner: areaManagers.get(kpi.businessAreaId) ?? "Ej angiven",
      },
    ]),
  );

  const kpiHistoryChanges = await getKpiHistoryChangeLinesSince(
    yesterdayCutoff,
    kpiNames,
  ).catch(() => []);

  const changedKpiIds = new Set(
    (recentKpiHistory ?? [])
      .filter((entry) =>
        isAfter(entry.recordedAt || entry.createdAt, yesterdayCutoff),
      )
      .map((entry) => entry.kpiId),
  );

  const newActivityCount = (activities ?? []).filter((activity) =>
    isAfter(activity.createdAt, yesterdayCutoff),
  ).length;
  const newGoalCount = (goals ?? []).filter((goal) =>
    isAfter(goal.createdAt, yesterdayCutoff),
  ).length;
  const closedDecisionCount = (allDecisions ?? []).filter(
    (decision) =>
      decision.status === "Klart" &&
      isAfter(decision.updatedAt, yesterdayCutoff),
  ).length;

  const statusChangeCount = (recentAudit ?? []).filter((entry) => {
    if (!isAfter(entry.createdAt, yesterdayCutoff)) {
      return false;
    }
    return (
      entry.action === "updated" ||
      entry.action === "completed" ||
      entry.description.toLowerCase().includes("status")
    );
  }).length;

  const yesterdayChanges = buildYesterdayChanges({
    newActivityCount,
    changedKpiCount: changedKpiIds.size,
    closedDecisionCount,
    newGoalCount,
    statusChangeCount,
    kpiHistoryLines: kpiHistoryChanges,
  });

  const historyEvents = buildHistoryEvents({
    auditEntries: recentAudit ?? [],
    kpiHistory: recentKpiHistory ?? [],
    kpiMeta,
    areaNames,
    limit: 20,
  });

  return {
    kpis: [
      {
        id: "business-areas",
        label: "Affärsområden",
        value: String(businessAreaCount),
        status: countStatus(businessAreaCount),
      },
      {
        id: "goals",
        label: "Mål",
        value: String(goalCount),
        status: countStatus(goalCount),
      },
      {
        id: "activities",
        label: "Aktiviteter",
        value: String(activityCount),
        status: countStatus(activityCount),
      },
      {
        id: "delayed-activities",
        label: "Försenade aktiviteter",
        value: String(delayedCount),
        status: delayedCount > 0 ? "Röd" : "Grön",
      },
      {
        id: "completed-goals",
        label: "Klara mål",
        value: String(completedGoalCount),
        status: countStatus(completedGoalCount),
      },
      {
        id: "ongoing-activities",
        label: "Pågående aktiviteter",
        value: String(ongoingActivityCount),
        status: countStatus(ongoingActivityCount),
      },
      {
        id: "areas-with-red-goals",
        label: "Affärsområden med röda mål",
        value: String(areasWithRedGoalsCount),
        status: areasWithRedGoalsCount > 0 ? "Röd" : "Grön",
      },
    ],
    businessAreas: (areaRows ?? []).map((area) => ({
      id: area.id,
      slug: area.slug,
      name: area.name,
      manager: area.manager ?? "Ej angiven",
      status: toStatusTone(area.status),
      goalCount: goalsByArea.get(area.id) ?? 0,
      activityCount: activitiesByArea.get(area.id) ?? 0,
      delayedActivityCount: delayedByArea.get(area.id) ?? 0,
      comment:
        area.vd_comment?.trim() ||
        latestCommentByArea.get(area.id) ||
        "Ingen kommentar ännu.",
    })),
    attentionItems,
    actionGoals,
    upcomingDecisions: upcoming.map((decision) => {
      const parts = [decision.businessAreaName];
      if (decision.dueDate) {
        parts.push(`Förfaller ${formatDateSv(decision.dueDate)}`);
      } else if (decision.meetingDate) {
        parts.push(`Möte ${formatDateSv(decision.meetingDate)}`);
      }
      if (decision.owner) {
        parts.push(decision.owner);
      }

      return {
        id: decision.id,
        title: decision.title,
        detail: parts.join(" · "),
      };
    }),
    recentEvents: (recentAudit ?? []).slice(0, 10).map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      actorName: event.actorName,
      description: event.description,
      href: event.href,
    })),
    historyEvents,
    vdFocus,
    sinceLoginChanges,
    vdAssistant,
    yesterdayChanges,
  };
}
