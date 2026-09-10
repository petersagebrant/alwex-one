import type { ActivityEscalation } from "@/types/activity-escalation";

export function isOpenEscalationStatus(
  status: ActivityEscalation["status"],
): boolean {
  return status === "open";
}

export function requiresEscalationFromHistory(
  escalations: Array<{ status: ActivityEscalation["status"] }>,
): boolean {
  return escalations.some((item) => isOpenEscalationStatus(item.status));
}

export function canStartNewEscalation(
  escalations: Array<{ status: ActivityEscalation["status"] }>,
): boolean {
  return !requiresEscalationFromHistory(escalations);
}

export function sortEscalationHistory<T extends { askedAt: string }>(
  escalations: T[],
): T[] {
  return [...escalations].sort((a, b) => a.askedAt.localeCompare(b.askedAt));
}

export function filterOpenLeadershipEscalations<
  T extends { status: ActivityEscalation["status"] },
>(items: T[]): T[] {
  return items.filter((item) => isOpenEscalationStatus(item.status));
}

/** Append a new Q&A row. Never mutates or overwrites previous history. */
export function appendEscalationHistory<T>(existing: T[], next: T): T[] {
  return [...existing, next];
}

export function activityStaysOpenAfterAnswer<
  T extends { status: string; requiresEscalation: boolean },
>(activity: T): T {
  return {
    ...activity,
    requiresEscalation: false,
  };
}
