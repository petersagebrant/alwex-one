import { getCurrentUser } from "@/lib/auth/require-user";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import { getActivities, type ActivityListItem } from "@/services/activities";
import { getAllActivityComments } from "@/services/activityComments";
import {
  getAuditLogSince,
  getRecentAuditLog,
  type AuditLogListItem,
} from "@/services/auditLog";
import { getDecisions } from "@/services/decisions";
import { getGoals } from "@/services/goals";
import { getKPIs, type KPIListItem } from "@/services/kpis";
import {
  getKpiHistoryForChangeReport,
  getRecentKpiHistoryEntries,
} from "@/services/kpiHistory";
import {
  buildSinceLoginChanges,
  formatSinceLoginTime,
  getSinceLoginCutoff,
  type SinceLoginChange,
} from "@/services/sinceLogin";
import {
  buildYesterdayChangeReport,
  getYesterdayCutoff,
  type YesterdayChangeItem,
} from "@/services/yesterdayChanges";
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
  /** Dynamiskt nuläge (2–4 meningar). */
  situation: string;
  /** Prioritet idag — viktigaste gula/röda KPI eller att inga kritiska avvikelser finns. */
  priority: string;
  /** Tre datadrivna observationer. */
  observations: string[];
  /** Kort positiv sammanfattning. */
  positiveSummary: string;
  /** Bakåtkompatibilitet: samma innehåll som priority. */
  recommendation: string;
  /** Bakåtkompatibilitet: situation uppdelad i rader. */
  highlights: string[];
  intro: string;
  riskLevel: DashboardVdAssistantRisk;
  riskLabel: string;
  analyzedAtLabel: string;
};

export type DashboardYesterdayChange = YesterdayChangeItem;

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

function firstNameFromUser(email: string | null): string | null {
  if (!email) {
    return null;
  }
  const local = email.split("@")[0]?.trim();
  if (!local) {
    return null;
  }
  const token = local.split(/[._-]/)[0] ?? local;
  if (!token) {
    return null;
  }
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function formatKpiStatusCounts(
  green: number,
  yellow: number,
  red: number,
): string {
  const parts: string[] = [];
  if (green > 0) {
    parts.push(
      green === 1 ? "1 KPI är grön" : `${green} KPI:er är gröna`,
    );
  }
  if (yellow > 0) {
    parts.push(yellow === 1 ? "1 gul" : `${yellow} gula`);
  }
  if (red > 0) {
    parts.push(red === 1 ? "1 röd" : `${red} röda`);
  }

  if (parts.length === 0) {
    return "Inga KPI:er är registrerade ännu.";
  }

  if (green > 0 && (yellow > 0 || red > 0)) {
    // "10 KPI:er är gröna, 3 gula och 1 röd."
    const rest = parts.slice(1);
    if (rest.length === 1) {
      return `${parts[0]}, ${rest[0]}.`;
    }
    return `${parts[0]}, ${rest.slice(0, -1).join(", ")} och ${rest[rest.length - 1]}.`;
  }

  return `${parts.join(", ")}.`;
}

function kpiObservation(kpi: KPIListItem): string {
  const area = kpi.businessAreaName;
  const name = kpi.name.toLowerCase();
  const current = (kpi.currentValue ?? "").replace(/\s/g, "");
  const isNegativeValue = current.startsWith("-") || current.startsWith("−");

  if (name.includes("resultat") && isNegativeValue) {
    return `${area} ligger under budget.`;
  }
  if (name.includes("belägg") && kpi.status !== "Grön") {
    return `${area} har lägre beläggning än målet.`;
  }
  if (
    (name.includes("volym") || kpi.trend === "Ner") &&
    kpi.status !== "Grön"
  ) {
    return `${area} har negativ volymtrend.`;
  }
  if (name.includes("budgetavvik") && kpi.status !== "Grön") {
    return `${area} har budgetavvikelse över mål.`;
  }
  if (kpi.status === "Röd") {
    return `${area}: KPI:n ${kpi.name} är röd.`;
  }
  return `${area}: KPI:n ${kpi.name} är gul.`;
}

function buildVdAssistant(input: {
  firstName: string | null;
  areaCount: number;
  greenKpiCount: number;
  yellowKpiCount: number;
  redKpiCount: number;
  delayedCount: number;
  openDecisionCount: number;
  greenAreaCount: number;
  yellowAreaNames: string[];
  redAreaNames: string[];
  followUpKpis: KPIListItem[];
  topFollowUpKpi: {
    name: string;
    owner: string;
    status: StatusTone;
    areaName: string;
  } | null;
  yellowGoals: { title: string; area: string }[];
}): DashboardVdAssistant {
  const yellowAreaNames = input.yellowAreaNames ?? [];
  const redAreaNames = input.redAreaNames ?? [];
  const followUpKpis = input.followUpKpis ?? [];
  const yellowGoals = input.yellowGoals ?? [];

  const greeting = input.firstName
    ? `God morgon ${input.firstName}.`
    : "God morgon.";

  const situationParts: string[] = [];
  situationParts.push(
    input.areaCount === 1
      ? "1 affärsområde följs upp."
      : `${input.areaCount} affärsområden följs upp.`,
  );
  situationParts.push(
    formatKpiStatusCounts(
      input.greenKpiCount,
      input.yellowKpiCount,
      input.redKpiCount,
    ),
  );
  situationParts.push(
    swedishCountPhrase(
      input.delayedCount,
      "1 aktivitet är försenad.",
      "{n} aktiviteter är försenade.",
      "Inga aktiviteter är försenade.",
    ),
  );

  if (input.topFollowUpKpi?.status === "Röd") {
    situationParts.push(
      `${input.topFollowUpKpi.areaName} har den viktigaste negativa avvikelsen.`,
    );
  } else if (redAreaNames.length > 0) {
    situationParts.push(
      `${redAreaNames[0]} har den viktigaste negativa avvikelsen.`,
    );
  } else if (input.topFollowUpKpi) {
    situationParts.push(
      `${input.topFollowUpKpi.areaName} kräver uppföljning via KPI:n ${input.topFollowUpKpi.name}.`,
    );
  } else if (yellowAreaNames.length > 0) {
    situationParts.push(
      `${yellowAreaNames[0]} följs upp med gul status.`,
    );
  }

  const situation = situationParts.slice(0, 4).join(" ");

  let priority: string;
  if (input.topFollowUpKpi) {
    priority = `Prioritet idag:\nFölj upp KPI:n ${input.topFollowUpKpi.name} tillsammans med ${input.topFollowUpKpi.owner}.`;
  } else {
    priority = "Inga kritiska avvikelser finns.";
  }

  const observationCandidates: string[] = [];
  for (const kpi of followUpKpis) {
    observationCandidates.push(kpiObservation(kpi));
  }
  for (const goal of yellowGoals) {
    observationCandidates.push(
      `Målet "${goal.title}" i ${goal.area} kräver uppföljning.`,
    );
  }
  if (input.delayedCount > 0) {
    observationCandidates.push(
      swedishCountPhrase(
        input.delayedCount,
        "1 aktivitet är försenad.",
        "{n} aktiviteter är försenade.",
        "",
      ),
    );
  }
  if (input.openDecisionCount === 0) {
    observationCandidates.push(
      "Inga öppna beslut blockerar verksamheten.",
    );
  } else {
    observationCandidates.push(
      swedishCountPhrase(
        input.openDecisionCount,
        "1 öppet beslut kräver uppföljning.",
        "{n} öppna beslut kräver uppföljning.",
        "",
      ),
    );
  }
  if (input.greenAreaCount > 0 && input.areaCount > 0) {
    observationCandidates.push(
      input.greenAreaCount === input.areaCount
        ? "Alla affärsområden har grön status."
        : `${input.greenAreaCount} av ${input.areaCount} affärsområden har grön status.`,
    );
  }

  const seen = new Set<string>();
  const observations: string[] = [];
  for (const line of observationCandidates) {
    if (!line || seen.has(line)) {
      continue;
    }
    seen.add(line);
    observations.push(line);
    if (observations.length >= 3) {
      break;
    }
  }
  while (observations.length < 3) {
    if (input.greenKpiCount > 0 && !seen.has("kpi-green")) {
      seen.add("kpi-green");
      observations.push(
        input.greenKpiCount === 1
          ? "1 KPI ligger inom mål."
          : `${input.greenKpiCount} KPI:er ligger inom mål.`,
      );
      continue;
    }
    if (!seen.has("follow-up-done")) {
      seen.add("follow-up-done");
      observations.push("Daglig uppföljning kan fokusera på gröna områden.");
      continue;
    }
    break;
  }

  let positiveSummary: string;
  const greenKpiShare =
    input.greenKpiCount + input.yellowKpiCount + input.redKpiCount > 0
      ? input.greenKpiCount /
        (input.greenKpiCount + input.yellowKpiCount + input.redKpiCount)
      : 1;
  if (input.redKpiCount === 0 && input.yellowKpiCount === 0) {
    positiveSummary = "Inga kritiska avvikelser — verksamheten ligger enligt plan.";
  } else if (greenKpiShare >= 0.6 || input.greenAreaCount >= input.areaCount / 2) {
    positiveSummary = "De flesta affärsområden utvecklas enligt plan.";
  } else if (input.redKpiCount > 0) {
    positiveSummary = `${input.greenKpiCount} KPI:er ligger fortfarande inom mål trots pågående avvikelser.`;
  } else {
    positiveSummary = "Avvikelserna är hanterbara och de flesta nyckeltal följer planen.";
  }

  let riskLevel: DashboardVdAssistantRisk = "Låg";
  if (
    redAreaNames.length > 0 ||
    input.delayedCount >= 2 ||
    input.topFollowUpKpi?.status === "Röd"
  ) {
    riskLevel = "Hög";
  } else if (input.yellowKpiCount > 0 || input.delayedCount > 0) {
    riskLevel = "Medel";
  }

  return {
    greeting,
    situation,
    priority,
    observations,
    positiveSummary,
    recommendation: priority,
    highlights: situationParts.slice(0, 4),
    intro: situation,
    riskLevel,
    riskLabel: riskLevel,
    analyzedAtLabel: formatDateTimeSv(new Date().toISOString()),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const [
    currentUser,
    areaRows,
    goals,
    activities,
    comments,
    allDecisions,
    recentAudit,
    allKpis,
    recentKpiHistory,
  ] = await Promise.all([
    getCurrentUser(),
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
  const greenKpis = (allKpis ?? []).filter((kpi) => kpi.status === "Grön");
  const yellowKpis = (allKpis ?? []).filter((kpi) => kpi.status === "Gul");
  const redKpis = (allKpis ?? []).filter((kpi) => kpi.status === "Röd");
  const redAreaRows = (areaRows ?? []).filter(
    (area) => toStatusTone(area.status) === "Röd",
  );
  const yellowAreaRows = (areaRows ?? []).filter(
    (area) => toStatusTone(area.status) === "Gul",
  );
  const greenAreaRows = (areaRows ?? []).filter(
    (area) => toStatusTone(area.status) === "Grön",
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

  const vdAssistant = buildVdAssistant({
    firstName: firstNameFromUser(currentUser?.email ?? null),
    areaCount: businessAreaCount,
    greenKpiCount: greenKpis.length,
    yellowKpiCount: yellowKpis.length,
    redKpiCount: redKpis.length,
    delayedCount,
    openDecisionCount: waitingDecisionCount,
    greenAreaCount: greenAreaRows.length,
    yellowAreaNames: yellowAreaRows.map((area) => area.name),
    redAreaNames: redAreaRows.map((area) => area.name),
    followUpKpis,
    topFollowUpKpi: topFollowUpKpi
      ? {
          name: topFollowUpKpi.name,
          owner:
            areaManagers.get(topFollowUpKpi.businessAreaId) ?? "ansvarig",
          status: topFollowUpKpi.status,
          areaName: topFollowUpKpi.businessAreaName,
        }
      : null,
    yellowGoals: (goals ?? [])
      .filter((goal) => goal.status === "Gul" || goal.status === "Röd")
      .map((goal) => ({
        title: goal.title,
        area: areaNames.get(goal.businessAreaId) ?? goal.businessAreaName,
      })),
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

  const [yesterdayAudit, yesterdayKpiHistory] = await Promise.all([
    getAuditLogSince(yesterdayCutoff, 200).catch(() => []),
    getKpiHistoryForChangeReport(yesterdayCutoff).catch(() => []),
  ]);

  const yesterdayChanges = buildYesterdayChangeReport({
    cutoff: yesterdayCutoff,
    auditEntries: yesterdayAudit,
    kpiHistory: yesterdayKpiHistory,
    kpis: allKpis ?? [],
    goals: goals ?? [],
    activities: activities ?? [],
    areas: (areaRows ?? []).map((area) => ({
      id: area.id,
      name: area.name,
      slug: area.slug,
      manager: area.manager ?? null,
      status: area.status,
    })),
    limit: 5,
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
