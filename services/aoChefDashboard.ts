import { createClient } from "@/lib/supabase/server";
import type { AuthProfile } from "@/lib/auth/require-user";
import {
  isStatusTone,
  isTargetKpi,
  parseKpiStoredStatus,
  parseStatusTone,
} from "@/lib/kpi/kind";
import { fetchBusinessAreaById } from "@/lib/supabase/business-areas";
import { getActivitiesByBusinessAreaId } from "@/services/activities";
import {
  getAuditLogSince,
  getRecentAuditLog,
  type AuditLogListItem,
} from "@/services/auditLog";
import type { DecisionListItem } from "@/services/decisions";
import { getGoalsByBusinessAreaId } from "@/services/goals";
import { buildDashboardHistoryEvents } from "@/services/historyFeed";
import {
  getKpiHistoryForChangeReport,
  getRecentKpiHistoryForKpis,
} from "@/services/kpiHistory";
import { getKPIsByBusinessArea } from "@/services/kpis";
import { getKpisForTodayReporting } from "@/services/kpiReporting";
import {
  buildSinceLoginChanges,
  getSinceLoginCutoff,
  type SinceLoginChange,
} from "@/services/sinceLogin";
import {
  buildYesterdayChangeReport,
  getYesterdayCutoff,
  type YesterdayChangeItem,
} from "@/services/yesterdayChanges";
import type {
  DecisionStatus,
  KPI,
  MyKpisForTodayReporting,
  StatusTone,
  VdDiaryEvent,
} from "@/types";

export type AoChefDashboardKpi = {
  id: string;
  name: string;
  kind: "TARGET" | "STATISTIC";
  status: StatusTone | "Statistik";
  currentValue: string | null;
  targetValue: string | null;
  unit: string | null;
  href: string;
};

export type AoChefDashboardGoal = {
  id: string;
  title: string;
  status: StatusTone;
  owner: string;
  deadline: string | null;
  href: string;
};

export type AoChefDashboardActivity = {
  id: string;
  title: string;
  status: string;
  owner: string;
  deadline: string | null;
  isDelayed: boolean;
  href: string;
};

export type AoChefDashboardDecision = {
  id: string;
  title: string;
  status: string;
  owner: string;
  dueDate: string | null;
  href: string;
};

export type AoChefDashboardData = {
  area: {
    id: string;
    name: string;
    slug: string;
    manager: string | null;
    status: StatusTone;
  };
  /** Display name for greeting — never from another user. */
  greetingName: string | null;
  reporting: MyKpisForTodayReporting;
  kpis: AoChefDashboardKpi[];
  kpiCounts: { green: number; yellow: number; red: number; total: number };
  goals: AoChefDashboardGoal[];
  goalCounts: { green: number; yellow: number; red: number; total: number };
  activities: AoChefDashboardActivity[];
  activityCounts: { total: number; delayed: number; ongoing: number };
  decisions: AoChefDashboardDecision[];
  yesterdayChanges: YesterdayChangeItem[];
  historyEvents: VdDiaryEvent[];
  sinceLoginChanges: SinceLoginChange[];
};

function toStatusTone(value: string | null | undefined): StatusTone {
  return parseStatusTone(value);
}

function countByStatus(statuses: StatusTone[]) {
  return statuses.reduce(
    (acc, status) => {
      if (status === "Grön") acc.green += 1;
      else if (status === "Gul") acc.yellow += 1;
      else if (status === "Röd") acc.red += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0, total: statuses.length },
  );
}

/**
 * AO overview status from own-area signals only (not business_areas.status).
 * Röd if any relevant red/delayed/overdue; else Gul if any yellow; else Grön.
 */
function computeAoOverviewStatus(input: {
  kpiStatuses: StatusTone[];
  goalStatuses: StatusTone[];
  delayedActivityCount: number;
  overdueOpenDecisionCount: number;
}): StatusTone {
  const hasRed =
    input.kpiStatuses.includes("Röd") ||
    input.goalStatuses.includes("Röd") ||
    input.delayedActivityCount > 0 ||
    input.overdueOpenDecisionCount > 0;
  if (hasRed) return "Röd";

  const hasYellow =
    input.kpiStatuses.includes("Gul") || input.goalStatuses.includes("Gul");
  if (hasYellow) return "Gul";

  return "Grön";
}

function todayDateKeyStockholm(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isDelayedActivity(input: {
  status: string;
  deadline: string | null;
}): boolean {
  if (input.status === "Klar" || input.status === "Försenad") {
    return input.status === "Försenad";
  }
  if (!input.deadline) return false;
  return input.deadline < todayDateKeyStockholm();
}

function isOverdueOpenDecision(input: {
  status: string;
  dueDate: string | null;
}): boolean {
  if (input.status === "Klart") return false;
  if (!input.dueDate) return false;
  return input.dueDate < todayDateKeyStockholm();
}

function firstNameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  const token = local.split(/[._-]/)[0]?.trim();
  if (!token) return null;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * Prefer auth user_metadata.full_name; never invent another person's name.
 */
async function resolveGreetingName(
  email: string | null,
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const metaName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : "";
    if (metaName) {
      return metaName;
    }
  } catch {
    // Fall through to email-derived name.
  }
  return firstNameFromEmail(email);
}

function filterAuditForArea(
  entries: AuditLogListItem[],
  businessAreaId: string,
  scopedEntityIds: {
    kpiIds: Set<string>;
    goalIds: Set<string>;
    activityIds: Set<string>;
    decisionIds: Set<string>;
  },
): AuditLogListItem[] {
  return entries.filter((entry) => {
    if (entry.businessAreaId === businessAreaId) return true;
    const entityId = entry.entityId;
    if (!entityId) return false;
    if (entry.entityType === "kpi" && scopedEntityIds.kpiIds.has(entityId)) {
      return true;
    }
    if (entry.entityType === "goal" && scopedEntityIds.goalIds.has(entityId)) {
      return true;
    }
    if (
      entry.entityType === "activity" &&
      scopedEntityIds.activityIds.has(entityId)
    ) {
      return true;
    }
    if (
      entry.entityType === "decision" &&
      scopedEntityIds.decisionIds.has(entityId)
    ) {
      return true;
    }
    return false;
  });
}

function toDecisionStatus(value: string): DecisionStatus {
  if (value === "Planerat" || value === "Pågår" || value === "Klart") {
    return value;
  }
  return "Planerat";
}

/** Area-scoped decisions only — avoids loading other AO rows into this dashboard. */
async function fetchDecisionsForBusinessArea(
  businessAreaId: string,
  areaName: string,
): Promise<DecisionListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("decisions")
    .select(
      "id, business_area_id, title, description, owner, meeting_date, due_date, status, created_at, updated_at",
    )
    .eq("business_area_id", businessAreaId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Kunde inte hämta beslut: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    businessAreaId: row.business_area_id,
    title: row.title,
    description: row.description,
    owner: row.owner,
    meetingDate: row.meeting_date,
    dueDate: row.due_date,
    status: toDecisionStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    businessAreaName: areaName,
  }));
}

function toKpiListItem(kpi: KPI, areaName: string) {
  return {
    ...kpi,
    businessAreaName: areaName,
  };
}

/**
 * AO-chef dashboard payload — scoped strictly to profile.businessAreaId.
 * Does not call getDashboardData(); VD path remains separate.
 */
export async function getAoChefDashboardData(
  profile: AuthProfile,
): Promise<AoChefDashboardData> {
  if (profile.role !== "ao_chef" || !profile.businessAreaId) {
    throw new Error("AO-chefsdashboard kräver role ao_chef och business_area_id.");
  }

  const businessAreaId = profile.businessAreaId;
  const areaRow = await fetchBusinessAreaById(businessAreaId);
  if (!areaRow) {
    throw new Error("Affärsområdet hittades inte.");
  }

  const areaName = areaRow.name;
  const [
    greetingName,
    kpis,
    goals,
    activities,
    decisions,
    reporting,
    recentAudit,
    auditSinceYesterday,
  ] = await Promise.all([
    resolveGreetingName(profile.email),
    getKPIsByBusinessArea(businessAreaId).catch(() => []),
    getGoalsByBusinessAreaId(businessAreaId).catch(() => []),
    getActivitiesByBusinessAreaId(businessAreaId).catch(() => []),
    fetchDecisionsForBusinessArea(businessAreaId, areaName).catch(() => []),
    getKpisForTodayReporting(businessAreaId, { businessAreaName: areaName }),
    getRecentAuditLog(80).catch(() => []),
    getAuditLogSince(getYesterdayCutoff(), 200).catch(() => []),
  ]);

  const kpiIds = new Set(kpis.map((kpi) => kpi.id));
  const goalIds = new Set(goals.map((goal) => goal.id));
  const activityIds = new Set(activities.map((activity) => activity.id));
  const decisionIds = new Set(decisions.map((decision) => decision.id));
  const scopedEntityIds = { kpiIds, goalIds, activityIds, decisionIds };

  const scopedRecentAudit = filterAuditForArea(
    recentAudit,
    businessAreaId,
    scopedEntityIds,
  );
  const scopedAuditSince = filterAuditForArea(
    auditSinceYesterday,
    businessAreaId,
    scopedEntityIds,
  );

  const kpiIdList = [...kpiIds];
  const [kpiHistoryRecent, kpiHistoryForChangesRaw] = await Promise.all([
    kpiIdList.length
      ? getRecentKpiHistoryForKpis(kpiIdList, 40).catch(() => [])
      : Promise.resolve([]),
    getKpiHistoryForChangeReport(getYesterdayCutoff()).catch(() => []),
  ]);
  const kpiHistoryForChanges = kpiHistoryForChangesRaw.filter((entry) =>
    kpiIds.has(entry.kpiId),
  );

  const kpiListItems = kpis.map((kpi) => toKpiListItem(kpi, areaName));
  const goalListItems = goals.map((goal) => ({
    ...goal,
    businessAreaName: areaName,
  }));
  const goalTitles = new Map(goals.map((goal) => [goal.id, goal.title]));
  const activityListItems = activities.map((activity) => ({
    ...activity,
    businessAreaName: areaName,
    goalTitle: activity.goalId
      ? goalTitles.get(activity.goalId) ?? null
      : null,
  }));
  const decisionListItems = decisions.map((decision) => ({
    ...decision,
    businessAreaName: areaName,
  }));

  const areaForBuilders = [
    {
      id: areaRow.id,
      name: areaRow.name,
      slug: areaRow.slug,
      manager: areaRow.manager,
      status: areaRow.status,
      updated_at: areaRow.updated_at,
      created_at: areaRow.created_at,
    },
  ];

  const yesterdayChanges = buildYesterdayChangeReport({
    cutoff: getYesterdayCutoff(),
    areas: areaForBuilders,
    kpis: kpiListItems,
    goals: goalListItems,
    activities: activityListItems,
    auditEntries: scopedAuditSince,
    kpiHistory: kpiHistoryForChanges,
  });

  const historyEvents = buildDashboardHistoryEvents({
    auditEntries: scopedRecentAudit,
    kpiHistory: kpiHistoryRecent,
    kpiMeta: new Map(
      kpiListItems.map((kpi) => [
        kpi.id,
        {
          name: kpi.name,
          area: areaName,
          owner: areaRow.manager?.trim() || "Ej angiven",
          kind: kpi.kind,
          unit: kpi.unit,
        },
      ]),
    ),
    goalTitles,
    activityTitles: new Map(
      activities.map((activity) => [activity.id, activity.title]),
    ),
    decisionTitles: new Map(
      decisions.map((decision) => [decision.id, decision.title]),
    ),
    areaNames: new Map([[businessAreaId, areaName]]),
    limit: 12,
  });

  const sinceLoginChanges = buildSinceLoginChanges({
    cutoff: getSinceLoginCutoff(),
    areas: areaForBuilders,
    kpis: kpiListItems,
    goals: goalListItems,
    activities: activityListItems,
    decisions: decisionListItems,
    auditEntries: scopedRecentAudit,
  });

  const kpiStatuses = kpis
    .filter(isTargetKpi)
    .map((kpi) => kpi.status)
    .filter(isStatusTone);
  const goalStatuses = goals.map((goal) => toStatusTone(goal.status));
  const delayed = activities.filter(isDelayedActivity);
  const ongoing = activities.filter((activity) => activity.status === "Pågår");
  const openDecisions = decisions.filter(
    (decision) => decision.status !== "Klart",
  );
  const overdueOpenDecisions = openDecisions.filter(isOverdueOpenDecision);
  const overviewStatus = computeAoOverviewStatus({
    kpiStatuses,
    goalStatuses,
    delayedActivityCount: delayed.length,
    overdueOpenDecisionCount: overdueOpenDecisions.length,
  });

  return {
    area: {
      id: areaRow.id,
      name: areaRow.name,
      slug: areaRow.slug,
      manager: areaRow.manager,
      /** Computed overview for this AO — not business_areas.status. */
      status: overviewStatus,
    },
    greetingName,
    reporting,
    kpis: kpis.map((kpi) => ({
      id: kpi.id,
      name: kpi.name,
      kind: kpi.kind,
      status: parseKpiStoredStatus(kpi.status),
      currentValue: kpi.currentValue,
      targetValue: kpi.targetValue,
      unit: kpi.unit,
      href: `/admin/kpis/${kpi.id}`,
    })),
    kpiCounts: countByStatus(kpiStatuses),
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      status: toStatusTone(goal.status),
      owner: goal.owner?.trim() || "Ej angiven",
      deadline: goal.deadline,
      href: `/admin/goals/${goal.id}`,
    })),
    goalCounts: countByStatus(goalStatuses),
    activities: activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      status: activity.status,
      owner: activity.owner?.trim() || "Ej angiven",
      deadline: activity.deadline,
      isDelayed: isDelayedActivity(activity),
      href: `/activities/${activity.id}`,
    })),
    activityCounts: {
      total: activities.length,
      delayed: delayed.length,
      ongoing: ongoing.length,
    },
    decisions: openDecisions.slice(0, 8).map((decision) => ({
      id: decision.id,
      title: decision.title,
      status: decision.status,
      owner: decision.owner?.trim() || "Ej angiven",
      dueDate: decision.dueDate,
      href: `/admin/decisions/${decision.id}`,
    })),
    yesterdayChanges,
    historyEvents,
    sinceLoginChanges,
  };
}
