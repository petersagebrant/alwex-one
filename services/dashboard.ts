import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import { getActivities } from "@/services/activities";
import { getAllActivityComments } from "@/services/activityComments";
import { getRecentAuditLog } from "@/services/auditLog";
import { getDecisions } from "@/services/decisions";
import { getGoals } from "@/services/goals";
import { getKPIs } from "@/services/kpis";
import { getKpiHistoryChangeLinesSince } from "@/services/kpiHistory";
import {
  buildSinceLoginChanges,
  getSinceLoginCutoff,
  type SinceLoginChange,
} from "@/services/sinceLogin";
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

function buildVdAssistant(input: {
  kpiFollowUpCount: number;
  delayedCount: number;
  redAreaCount: number;
  yellowAreaNames: string[];
  redAreaNames: string[];
  openDecisionCount: number;
  topFollowUpKpi: { name: string; owner: string } | null;
}): DashboardVdAssistant {
  const highlights: string[] = [
    swedishCountPhrase(
      input.kpiFollowUpCount,
      "1 KPI behöver följas upp.",
      "{n} KPI behöver följas upp.",
      "Inga KPI behöver följas upp.",
    ),
    swedishCountPhrase(
      input.delayedCount,
      "1 aktivitet är försenad.",
      "{n} aktiviteter är försenade.",
      "Inga aktiviteter är försenade.",
    ),
  ];

  if (input.redAreaNames.length > 0) {
    for (const name of input.redAreaNames.slice(0, 2)) {
      highlights.push(`${name} har röd status.`);
    }
  } else if (input.yellowAreaNames.length > 0) {
    const [first, ...rest] = input.yellowAreaNames;
    highlights.push(`${first} har fortfarande gul status.`);
    if (rest.length === 0) {
      highlights.push(
        "Inga andra affärsområden kräver din uppmärksamhet.",
      );
    } else {
      highlights.push(
        swedishCountPhrase(
          rest.length,
          "Ytterligare 1 affärsområde har gul status.",
          "Ytterligare {n} affärsområden har gul status.",
          "Inga andra affärsområden kräver din uppmärksamhet.",
        ),
      );
    }
  } else {
    highlights.push("Inga affärsområden kräver din uppmärksamhet.");
  }

  let recommendation: string;
  if (input.topFollowUpKpi) {
    recommendation = `Min rekommendation är att idag börja med att följa upp KPI:n ${input.topFollowUpKpi.name} tillsammans med ${input.topFollowUpKpi.owner}.`;
  } else if (input.delayedCount > 0) {
    recommendation =
      "Min rekommendation är att idag börja med de försenade aktiviteterna och säkra nästa steg med ansvariga.";
  } else if (input.openDecisionCount > 0) {
    recommendation =
      "Min rekommendation är att idag driva de öppna besluten framåt så att de inte ligger still.";
  } else {
    recommendation =
      "Min rekommendation är att behålla den dagliga översikten och följa upp eventuella gulmarkeringar i tid.";
  }

  const manyDelayed = input.delayedCount >= 2;
  let riskLevel: DashboardVdAssistantRisk = "Låg";
  if (input.redAreaCount > 0 || manyDelayed) {
    riskLevel = "Hög";
  } else if (input.kpiFollowUpCount > 0 || input.delayedCount > 0) {
    riskLevel = "Medel";
  }

  const riskLabel =
    riskLevel === "Hög"
      ? "Hög"
      : riskLevel === "Medel"
        ? "Medel"
        : "Låg";

  return {
    greeting: "God morgon Peter.",
    intro: "Här är min sammanfattning av läget just nu.",
    highlights,
    recommendation,
    riskLevel,
    riskLabel,
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
    recentEvents,
    allKpis,
  ] = await Promise.all([
    fetchBusinessAreas(),
    getGoals(),
    getActivities(),
    getAllActivityComments(),
    getDecisions().catch(() => []),
    getRecentAuditLog(30),
    getKPIs().catch(() => []),
  ]);

  const openDecisions = allDecisions
    .filter((decision) => decision.status !== "Klart")
    .sort((a, b) => {
      const aDate = a.dueDate ?? a.meetingDate ?? "9999-12-31";
      const bDate = b.dueDate ?? b.meetingDate ?? "9999-12-31";
      return aDate.localeCompare(bDate);
    });
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
  const redAreaRows = areaRows.filter(
    (area) => toStatusTone(area.status) === "Röd",
  );
  const yellowAreaRows = areaRows.filter(
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

  const vdAssistant = buildVdAssistant({
    kpiFollowUpCount: followUpKpis.length,
    delayedCount,
    redAreaCount,
    yellowAreaNames: yellowAreaRows.map((area) => area.name),
    redAreaNames: redAreaRows.map((area) => area.name),
    openDecisionCount: waitingDecisionCount,
    topFollowUpKpi: topFollowUpKpi
      ? {
          name: topFollowUpKpi.name,
          owner:
            areaManagers.get(topFollowUpKpi.businessAreaId) ?? "ansvarig",
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
      href: `/admin/decisions?edit=${decision.id}`,
    })),
  };

  const sinceLoginChanges = buildSinceLoginChanges({
    cutoff: getSinceLoginCutoff(),
    auditEntries: recentEvents,
    kpis: allKpis,
    goals,
    activities,
    decisions: allDecisions,
    areas: areaRows,
    limit: 5,
  });

  const yesterdayCutoff = getYesterdayCutoff();
  const kpiNames = new Map(allKpis.map((kpi) => [kpi.id, kpi.name]));
  const kpiHistoryChanges = await getKpiHistoryChangeLinesSince(
    yesterdayCutoff,
    kpiNames,
  );

  const yesterdayChanges: DashboardYesterdayChange[] = [
    ...kpiHistoryChanges,
  ];

  const newActivities = activities.filter((activity) =>
    isAfter(activity.createdAt, yesterdayCutoff),
  );
  if (newActivities.length === 1) {
    yesterdayChanges.push({
      id: `activity-created-${newActivities[0].id}`,
      text: "Ny aktivitet skapad",
    });
  } else if (newActivities.length > 1) {
    yesterdayChanges.push({
      id: "activities-created",
      text: `${newActivities.length} nya aktiviteter skapade`,
    });
  }

  const closedDecisions = allDecisions.filter(
    (decision) =>
      decision.status === "Klart" &&
      isAfter(decision.updatedAt, yesterdayCutoff),
  );
  if (closedDecisions.length === 1) {
    yesterdayChanges.push({
      id: `decision-closed-${closedDecisions[0].id}`,
      text: "Ett beslut stängt",
    });
  } else if (closedDecisions.length > 1) {
    yesterdayChanges.push({
      id: "decisions-closed",
      text: `${closedDecisions.length} beslut stängda`,
    });
  }

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
    sinceLoginChanges,
    vdAssistant,
    yesterdayChanges,
  };
}
