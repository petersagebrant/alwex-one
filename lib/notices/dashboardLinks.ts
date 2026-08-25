/** Area Aktuellt board — existing route, no parallel create form. */
export function areaNoticesHref(areaSlug: string): string {
  return `/areas/${areaSlug}`;
}

export function newAreaNoticeHref(areaSlug: string): string {
  return `/areas/${areaSlug}?notice=new`;
}

/**
 * "Se alla" on the org feed. AO-chefs may only follow their own area
 * (`/areas/{other-slug}` 404s for them). VD/admin keep per-notice links.
 */
export function noticeSeeAllHref(
  noticeAreaSlug: string | null | undefined,
  ownAreaSlug?: string | null,
): string | null {
  if (ownAreaSlug) {
    return noticeAreaSlug === ownAreaSlug
      ? areaNoticesHref(ownAreaSlug)
      : null;
  }
  return noticeAreaSlug ? areaNoticesHref(noticeAreaSlug) : "/areas";
}
