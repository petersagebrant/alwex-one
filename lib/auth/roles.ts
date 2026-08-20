export const APP_ROLES = [
  "vd",
  "ao_chef",
  "administrator",
  "lasbehorighet",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  vd: "VD",
  ao_chef: "AO-chef",
  administrator: "Administratör",
  lasbehorighet: "Läsbehörighet",
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/** VD / Administratör / AO-chef — create & update KPI, mål, aktiviteter. */
export function canWriteOperational(role: AppRole): boolean {
  return role === "vd" || role === "administrator" || role === "ao_chef";
}

/** VD / Administratör — create & update beslut. */
export function canWriteDecisions(role: AppRole): boolean {
  return role === "vd" || role === "administrator";
}

/** VD / Administratör — create & update affärsområden. */
export function canManageBusinessAreas(role: AppRole): boolean {
  return role === "vd" || role === "administrator";
}

/** VD / Administratör — inbjuda, ändra roll och inaktivera användare. */
export function canAdministerUsers(role: AppRole): boolean {
  return role === "vd" || role === "administrator";
}

export function canReadOnly(role: AppRole): boolean {
  return role === "lasbehorighet";
}
