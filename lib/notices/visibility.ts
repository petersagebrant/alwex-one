import { stockholmCalendarDate } from "@/lib/kpi/dailyReportDate";

export const ALWEX_TOTALT_SLUG = "alwex-totalt";

export function isAlwexTotaltSlug(
  slug: string | null | undefined,
): boolean {
  return slug === ALWEX_TOTALT_SLUG;
}

/** Aktuell: not archived and ends_on is null or on/after Stockholm today. */
export function isCurrentAreaNotice(
  notice: { archivedAt: string | null; endsOn: string | null },
  today: string = stockholmCalendarDate(),
): boolean {
  if (notice.archivedAt) {
    return false;
  }
  if (!notice.endsOn) {
    return true;
  }
  return notice.endsOn >= today;
}

/** Utgången: not archived, ends_on before Stockholm today. */
export function isExpiredAreaNotice(
  notice: { archivedAt: string | null; endsOn: string | null },
  today: string = stockholmCalendarDate(),
): boolean {
  if (notice.archivedAt || !notice.endsOn) {
    return false;
  }
  return notice.endsOn < today;
}

export function isArchivedAreaNotice(notice: {
  archivedAt: string | null;
}): boolean {
  return Boolean(notice.archivedAt);
}

export function currentAreaNoticesOnly<
  T extends { archivedAt: string | null; endsOn: string | null },
>(notices: T[], today: string = stockholmCalendarDate()): T[] {
  return notices.filter((notice) => isCurrentAreaNotice(notice, today));
}
