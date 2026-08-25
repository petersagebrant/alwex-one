import {
  AREA_NOTICE_KINDS,
  type AreaNoticeKind,
} from "@/types/area-notice";

export type { AreaNoticeKind };
export { AREA_NOTICE_KINDS };

export const AREA_NOTICE_KIND_LABELS: Record<AreaNoticeKind, string> = {
  Information: "Information",
  Behov: "Behov",
  Viktigt: "Viktigt",
  Driftstörning: "Driftstörning",
};

/** Dashboard rank: Driftstörning, Viktigt, then Behov, Information. */
export const AREA_NOTICE_KIND_RANK: Record<AreaNoticeKind, number> = {
  Driftstörning: 0,
  Viktigt: 1,
  Behov: 2,
  Information: 3,
};

export function isAreaNoticeKind(
  value: string | null | undefined,
): value is AreaNoticeKind {
  return (
    value === "Information" ||
    value === "Behov" ||
    value === "Viktigt" ||
    value === "Driftstörning"
  );
}

export function parseAreaNoticeKind(
  value: string | null | undefined,
): AreaNoticeKind {
  return isAreaNoticeKind(value) ? value : "Information";
}

export const AREA_NOTICE_TITLE_MAX = 80;
export const AREA_NOTICE_BODY_MAX = 400;
export const DASHBOARD_NOTICE_LIMIT = 8;
export const DASHBOARD_NOTICE_BODY_MAX = 140;
