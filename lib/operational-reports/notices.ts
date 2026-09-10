import { isOrganizationWideNotice } from "@/lib/notices/organizationWide";
import type { AreaNoticeKind } from "@/types/area-notice";

const RELEVANT_KINDS: ReadonlySet<AreaNoticeKind> = new Set([
  "Driftstörning",
  "Viktigt",
]);

/** Driftstörning, Viktigt, and organization-wide notices. */
export function isDailySteeringNotice(notice: {
  kind: AreaNoticeKind;
  businessAreaId: string | null;
}): boolean {
  return (
    RELEVANT_KINDS.has(notice.kind) ||
    isOrganizationWideNotice(notice.businessAreaId)
  );
}

export function filterDailySteeringNotices<
  T extends { kind: AreaNoticeKind; businessAreaId: string | null },
>(notices: T[]): T[] {
  return notices.filter(isDailySteeringNotice);
}
