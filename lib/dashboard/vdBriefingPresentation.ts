export type VdBriefingCollapseKind =
  | "attention"
  | "risks"
  | "recommendations"
  | "positive";

/**
 * Mobile-only: Kräver uppmärksamhet stays open. Side cards collapse.
 * Desktop briefing layout is unchanged.
 */
export function isVdBriefingSectionCollapsedOnMobile(
  kind: VdBriefingCollapseKind,
): boolean {
  return kind !== "attention";
}
