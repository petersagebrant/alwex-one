/** Soft-archive: archivedAt set means hidden from operational views. */
export function isGoalArchived(goal: { archivedAt: string | null }): boolean {
  return Boolean(goal.archivedAt);
}

export function activeGoalsOnly<T extends { archivedAt: string | null }>(
  goals: T[],
): T[] {
  return goals.filter((goal) => !isGoalArchived(goal));
}
