/** Area Aktuellt board — existing route, no parallel create form. */
export function areaNoticesHref(areaSlug: string): string {
  return `/areas/${areaSlug}`;
}

export function newAreaNoticeHref(areaSlug: string): string {
  return `/areas/${areaSlug}?notice=new`;
}

/** VD/admin create — existing admin form with operational area picker. */
export function newOrgNoticeHref(): string {
  return "/admin/aktuellt?new=1";
}

/**
 * Clickable notice card/title. AO-chef only for own area (other slugs 404).
 * VD/admin: every operational area page. No notice-id anchor exists.
 */
export function noticeItemHref(
  noticeAreaSlug: string | null | undefined,
  ownAreaSlug?: string | null,
): string | null {
  if (!noticeAreaSlug) {
    return null;
  }
  if (ownAreaSlug) {
    return noticeAreaSlug === ownAreaSlug
      ? areaNoticesHref(ownAreaSlug)
      : null;
  }
  return areaNoticesHref(noticeAreaSlug);
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
