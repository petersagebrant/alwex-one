import type { ActivityStatus } from "@/types/activity";

export function isOpenActivityStatus(status: ActivityStatus): boolean {
  return status !== "Klar";
}

export function isOverdueActivity(
  activity: { status: ActivityStatus; deadline: string | null },
  today: string,
): boolean {
  if (activity.status === "Klar") {
    return false;
  }
  if (activity.status === "Försenad") {
    return true;
  }
  if (!activity.deadline) {
    return false;
  }
  return activity.deadline < today;
}

export function filterOpenActivities<
  T extends { status: ActivityStatus },
>(activities: T[]): T[] {
  return activities.filter((activity) => isOpenActivityStatus(activity.status));
}

export function filterEscalatedOpenActivities<
  T extends { status: ActivityStatus; requiresEscalation: boolean },
>(activities: T[]): T[] {
  return activities.filter(
    (activity) =>
      activity.requiresEscalation && isOpenActivityStatus(activity.status),
  );
}

export function sortOpenActivities<
  T extends {
    status: ActivityStatus;
    deadline: string | null;
    createdAt: string;
    requiresEscalation?: boolean;
  },
>(activities: T[], today: string): T[] {
  return [...activities].sort((a, b) => {
    const aOverdue = isOverdueActivity(a, today) ? 0 : 1;
    const bOverdue = isOverdueActivity(b, today) ? 0 : 1;
    if (aOverdue !== bOverdue) {
      return aOverdue - bOverdue;
    }
    const aDeadline = a.deadline ?? "9999-12-31";
    const bDeadline = b.deadline ?? "9999-12-31";
    if (aDeadline !== bDeadline) {
      return aDeadline.localeCompare(bDeadline);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function sortEscalatedActivities<
  T extends { escalatedAt: string | null; createdAt: string },
>(activities: T[]): T[] {
  return [...activities].sort((a, b) => {
    const aAt = a.escalatedAt ?? a.createdAt;
    const bAt = b.escalatedAt ?? b.createdAt;
    return bAt.localeCompare(aAt);
  });
}
