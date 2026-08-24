import { canWriteOperational, type AppRole } from "@/lib/auth/roles";

/**
 * Who may create/edit/archive goals in the UI.
 * Matches RLS can_write_operational: VD/admin all areas, AO-chef own area,
 * lasbehorighet none. Archive of own-area goals by AO-chef is intentional
 * (KPI archive is stricter: VD/admin only).
 */
export function canWriteGoals(role: AppRole): boolean {
  return canWriteOperational(role);
}

export function canWriteGoalsForArea(
  role: AppRole,
  profileBusinessAreaId: string | null,
  areaId: string,
): boolean {
  if (!canWriteOperational(role)) {
    return false;
  }
  if (role === "ao_chef") {
    return profileBusinessAreaId === areaId;
  }
  return true;
}
