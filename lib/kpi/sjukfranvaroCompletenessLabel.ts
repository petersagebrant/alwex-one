/**
 * VD dashboard completeness copy for "Sjukfrånvaro Alwex".
 * Incomplete: preliminary wording with (reported of total).
 * Complete: no label — the displayed total is the final daily value.
 */
export function formatSjukfranvaroVdCompletenessLabel(input: {
  reportedAreas: number;
  totalAreas: number;
  isComplete: boolean;
}): string | null {
  if (input.reportedAreas <= 0) {
    return null;
  }
  if (input.isComplete) {
    return null;
  }
  return `Preliminärt – baserat på rapporterade affärsområden (${input.reportedAreas} av ${input.totalAreas})`;
}
