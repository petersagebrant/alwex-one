import type {
  Activity,
  BusinessArea,
  BusinessAreaSummary,
  HistoryEvent,
  Kpi,
} from "@/types";
import { activities } from "./activities";
import { businessAreas } from "./business-areas";
import { goals } from "./goals";
import { historyEvents } from "./history";
import { kpis } from "./kpis";

export {
  activities,
  businessAreas,
  goals,
  historyEvents,
  kpis,
};

export function getBusinessAreaSummaries(): BusinessAreaSummary[] {
  return businessAreas.map((area) => ({
    slug: area.slug,
    name: area.name,
    manager: area.manager,
    status: area.status,
    updatedAt: area.updatedAt,
    goalCount: goals.filter((goal) => goal.areaSlug === area.slug).length,
    activityCount: activities.filter(
      (activity) => activity.areaSlug === area.slug,
    ).length,
  }));
}

export function getBusinessAreaBySlug(slug: string): BusinessArea | undefined {
  return businessAreas.find((area) => area.slug === slug);
}

export function getGoalsByArea(slug: string) {
  return goals.filter((goal) => goal.areaSlug === slug);
}

export function getKpisByArea(slug: string): Kpi[] {
  return kpis.filter((kpi) => kpi.areaSlug === slug);
}

export function getActivitiesByArea(slug: string): Activity[] {
  return activities.filter((activity) => activity.areaSlug === slug);
}

export function getHistoryByArea(slug: string): HistoryEvent[] {
  return historyEvents
    .filter((event) => event.areaSlug === slug)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getAllAreaSlugs(): string[] {
  return businessAreas.map((area) => area.slug);
}
