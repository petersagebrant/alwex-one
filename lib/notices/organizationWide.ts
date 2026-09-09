export const ORGANIZATION_WIDE_AREA_VALUE = "org";
export const ORGANIZATION_WIDE_NOTICE_LABEL = "Hela organisationen";

export function isOrganizationWideNotice(
  businessAreaId: string | null | undefined,
): boolean {
  return businessAreaId == null || businessAreaId === "";
}

export function isOrganizationWideAreaValue(
  value: string | null | undefined,
): boolean {
  return value === ORGANIZATION_WIDE_AREA_VALUE;
}

export function areaNoticeAreaLabel(
  businessAreaId: string | null | undefined,
  areaName?: string | null,
): string {
  if (isOrganizationWideNotice(businessAreaId)) {
    return ORGANIZATION_WIDE_NOTICE_LABEL;
  }
  const name = areaName?.trim();
  return name ? name : "Okänt område";
}

/** Area page / AO feed: that area’s posts plus org-wide. */
export function areaNoticeMatchesAreaFeed(
  noticeBusinessAreaId: string | null | undefined,
  areaId: string,
): boolean {
  return (
    isOrganizationWideNotice(noticeBusinessAreaId) ||
    noticeBusinessAreaId === areaId
  );
}

export function areaNoticeReaderOrFilter(areaId: string): string {
  return `business_area_id.eq.${areaId},business_area_id.is.null`;
}
