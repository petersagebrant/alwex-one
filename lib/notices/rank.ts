import {
  AREA_NOTICE_KIND_RANK,
  DASHBOARD_NOTICE_BODY_MAX,
  DASHBOARD_NOTICE_LIMIT,
  type AreaNoticeKind,
} from "@/lib/notices/kind";

export function rankDashboardNotices<
  T extends { kind: AreaNoticeKind; createdAt: string },
>(notices: T[], limit = DASHBOARD_NOTICE_LIMIT): T[] {
  return [...notices]
    .sort((a, b) => {
      const rank =
        AREA_NOTICE_KIND_RANK[a.kind] - AREA_NOTICE_KIND_RANK[b.kind];
      if (rank !== 0) {
        return rank;
      }
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, limit);
}

export function truncateNoticeBody(
  body: string,
  max = DASHBOARD_NOTICE_BODY_MAX,
): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
