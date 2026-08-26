export const APP_ROLES = [
  "vd",
  "vice_vd",
  "ao_chef",
  "administrator",
  "lasbehorighet",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  vd: "VD",
  vice_vd: "Vice VD",
  ao_chef: "AO-chef",
  administrator: "Administratör",
  lasbehorighet: "Läsbehörighet",
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

export function isVdEquivalent(role: AppRole): role is "vd" | "vice_vd" {
  return role === "vd" || role === "vice_vd";
}

/** Only AO-chef is scoped to one business area. VD / Vice VD / admin / läsbehörighet must be null. */
export function roleRequiresBusinessArea(role: AppRole): boolean {
  return role === "ao_chef";
}

/** VD / Vice VD / Administratör / AO-chef — create & update KPI, mål, aktiviteter. */
export function canWriteOperational(role: AppRole): boolean {
  return isVdEquivalent(role) || role === "administrator" || role === "ao_chef";
}

/** VD / Vice VD / Administratör — create & update beslut. */
export function canWriteDecisions(role: AppRole): boolean {
  return isVdEquivalent(role) || role === "administrator";
}

/** VD / Vice VD / Administratör — create & update affärsområden. */
export function canManageBusinessAreas(role: AppRole): boolean {
  return isVdEquivalent(role) || role === "administrator";
}

/** VD / Vice VD / Administratör — inbjuda, ändra roll och inaktivera användare. */
export function canAdministerUsers(role: AppRole): boolean {
  return isVdEquivalent(role) || role === "administrator";
}

/** VD / Vice VD — ange tillfälligt lösenord. Inte administratör eller AO-chef. */
export function canSetUserPassword(role: AppRole): boolean {
  return isVdEquivalent(role);
}

export function canReadOnly(role: AppRole): boolean {
  return role === "lasbehorighet";
}
