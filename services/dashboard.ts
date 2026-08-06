import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { formatDateSv } from "@/lib/format/date";
import { getActivities } from "@/services/activities";
import { getAllActivityComments } from "@/services/activityComments";
import { getRecentAuditLog } from "@/services/auditLog";
import { getUpcomingDecisions } from "@/services/decisions";
import { getGoals } from "@/services/goals";
import { getKPIs } from "@/services/kpis";
import type { StatusTone } from "@/types";

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

export type DashboardData = {
  kpis: DashboardKpi[];
  businessAreas: DashboardArea[];
  attentionItems: DashboardAttentionItem[];
  actionGoals: DashboardActionGoal[];
  upcomingDecisions: DashboardDecisionItem[];
  recentEvents: DashboardRecentEvent[];
  vdFocus: DashboardVdFocus;
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

export async function getDashboardData(): Promise<DashboardData> {
  const [
    areaRows,
    goals,
    activities,
    comments,
    openDecisions,
    recentEvents,
    allKpis,
  ] = await Promise.all([
    fetchBusinessAreas(),
    getGoals(),
    getActivities(),
    getAllActivityComments(),
    getUpcomingDecisions(1000),
    getRecentAuditLog(10),
    getKPIs().catch(() => []),
  ]);

  const upcoming = openDecisions.slice(0, 5);

  const completedGoals = goals.filter((goal) => goal.status === "Grön");
  const ongoingActivities = activities.filter(
    (activity) => activity.status === "Pågår",
  );
  const delayedActivities = activities.filter(
    (activity) => activity.status === "Försenad",
  );

  const areaNames = new Map(areaRows.map((area) => [area.id, area.name]));
  const activityAreaMap = new Map(
    activities.map((activity) => [activity.id, activity.businessAreaId]),
  );

  const goalsByArea = new Map<string, number>();
  for (const goal of goals) {
    goalsByArea.set(
      goal.businessAreaId,
      (goalsByArea.get(goal.businessAreaId) ?? 0) + 1,
    );
  }

  const activitiesByArea = new Map<string, number>();
  const delayedByArea = new Map<string, number>();
  for (const activity of activities) {
    activitiesByArea.set(
      activity.businessAreaId,
      (activitiesByArea.get(activity.businessAreaId) ?? 0) + 1,
    );
    if (activity.status === "Försenad") {
      delayedByArea.set(
        activity.businessAreaId,
        (delayedByArea.get(activity.businessAreaId) ?? 0) + 1,
      );
    }
  }

  const latestCommentByArea = new Map<string, string>();
  for (const comment of comments) {
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
  for (const goal of goals) {
    if (goal.status !== "Röd") {
      continue;
    }
    redGoalsByArea.set(
      goal.businessAreaId,
      (redGoalsByArea.get(goal.businessAreaId) ?? 0) + 1,
    );
  }

  const attentionItems: DashboardAttentionItem[] = areaRows
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

  const actionGoals: DashboardActionGoal[] = goals
    .filter((goal) => goal.status === "Röd" || goal.status === "Gul")
    .map((goal) => ({
      id: goal.id,
      goal: goal.title,
      area: areaNames.get(goal.businessAreaId) ?? goal.businessAreaName,
      owner: goal.owner ?? "Ej angiven",
      deadline: goal.deadline ?? "—",
      status: goal.status,
    }));

  const businessAreaCount = areaRows.length;
  const goalCount = goals.length;
  const activityCount = activities.length;
  const completedGoalCount = completedGoals.length;
  const ongoingActivityCount = ongoingActivities.length;
  const delayedCount = delayedActivities.length;
  const areasWithRedGoalsCount = redGoalsByArea.size;

  const areaManagers = new Map(
    areaRows.map((area) => [area.id, area.manager ?? "Ej angiven"]),
  );

  const followUpKpis = allKpis.filter(
    (kpi) => kpi.status === "Gul" || kpi.status === "Röd",
  );
  const redAreaCount = areaRows.filter(
    (area) => toStatusTone(area.status) === "Röd",
  ).length;
  const waitingDecisionCount = openDecisions.length;

  const hasCritical =
    delayedCount > 0 ||
    followUpKpis.some((kpi) => kpi.status === "Röd") ||
    redAreaCount > 0;
  const hasFollowUp =
    followUpKpis.some((kpi) => kpi.status === "Gul") ||
    waitingDecisionCount > 0;

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
      href: `/admin/kpis?edit=${kpi.id}`,
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
      href: `/admin/decisions?edit=${decision.id}`,
    })),
  };

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
    businessAreas: areaRows.map((area) => ({
      id: area.id,
      slug: area.slug,
      name: area.name,
      manager: area.manager ?? "Ej angiven",
      status: toStatusTone(area.status),
      goalCount: goalsByArea.get(area.id) ?? 0,
      activityCount: activitiesByArea.get(area.id) ?? 0,
      delayedActivityCount: delayedByArea.get(area.id) ?? 0,
      comment: latestCommentByArea.get(area.id) ?? "Ingen kommentar ännu.",
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
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      actorName: event.actorName,
      description: event.description,
      href: event.href,
    })),
    vdFocus,
  };
}
