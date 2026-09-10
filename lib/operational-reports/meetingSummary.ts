/**
 * Hook for a later morgonsammanfattning (not rendered on the board yet).
 * Example: "3 avvikelser, 2 åtgärder, 1 eskalering".
 */
export type DailySteeringSummaryDraft = {
  safetyCount: number;
  driftCount: number;
  incomingCount: number;
  attentionKpiCount: number;
  openActionCount: number;
  overdueActionCount: number;
  escalationCount: number;
};

export function draftDailySteeringSummary(
  input: DailySteeringSummaryDraft,
): { counts: DailySteeringSummaryDraft; line: string } {
  const deviationCount = input.safetyCount + input.driftCount + input.incomingCount;
  return {
    counts: input,
    line: `${deviationCount} avvikelser, ${input.openActionCount} åtgärder, ${input.escalationCount} eskaleringar`,
  };
}
