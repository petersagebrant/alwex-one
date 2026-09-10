import { canAdministerUsers, isVdEquivalent, type AppRole } from "@/lib/auth/roles";

export type AppNavKey =
  | "home"
  | "areas"
  | "goals"
  | "activities"
  | "decisions"
  | "kpis"
  | "users"
  | "assistant";

export type AppNavItem = {
  key: AppNavKey;
  href: string;
  label: string;
};

export type AppNavVisibilityProfile = {
  role: AppRole;
  business_area_id?: string | null;
} | null;

/** Same labels and hrefs as the desktop header. */
export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  { key: "home", href: "/", label: "Dashboard" },
  { key: "areas", href: "/areas", label: "Affärsområden" },
  { key: "goals", href: "/admin/goals", label: "Mål" },
  { key: "activities", href: "/admin/activities", label: "Aktiviteter" },
  { key: "decisions", href: "/admin/decisions", label: "Beslut" },
  { key: "kpis", href: "/report/kpis", label: "KPI" },
  { key: "users", href: "/admin/users", label: "Användare" },
  { key: "assistant", href: "/assistant", label: "AI-assistent" },
];

/** Primary tabs on the mobile bottom bar. Remaining items go in Mer. */
export const MOBILE_TAB_NAV_KEYS: readonly AppNavKey[] = [
  "home",
  "areas",
  "kpis",
];

export function isAppNavItemVisible(
  item: Pick<AppNavItem, "key">,
  profile: AppNavVisibilityProfile,
): boolean {
  if (item.key === "assistant") {
    return (
      Boolean(profile && isVdEquivalent(profile.role)) ||
      (profile?.role === "ao_chef" && Boolean(profile.business_area_id))
    );
  }
  if (item.key === "users") {
    return Boolean(profile && canAdministerUsers(profile.role));
  }
  return true;
}

export function visibleAppNavItems(
  profile: AppNavVisibilityProfile,
): AppNavItem[] {
  return APP_NAV_ITEMS.filter((item) => isAppNavItemVisible(item, profile));
}

export function splitMobileAppNav(items: readonly AppNavItem[]): {
  tabs: AppNavItem[];
  more: AppNavItem[];
} {
  const tabSet = new Set<AppNavKey>(MOBILE_TAB_NAV_KEYS);
  const tabs = MOBILE_TAB_NAV_KEYS.map((key) =>
    items.find((item) => item.key === key),
  ).filter((item): item is AppNavItem => Boolean(item));
  const more = items.filter((item) => !tabSet.has(item.key));
  return { tabs, more };
}

export function isMobileMoreNavActive(
  current: AppNavKey | undefined,
  more: readonly AppNavItem[],
): boolean {
  return Boolean(current && more.some((item) => item.key === current));
}
