import { canWriteOperational, type AppRole } from "@/lib/auth/roles";

/**
 * Who may create/edit/archive Aktuellt in the UI.
 * Matches RLS can_write_operational: VD/admin all areas, AO-chef own area,
 * lasbehorighet none. Read is org-wide for every authenticated user.
 */
export function canWriteAreaNotices(role: AppRole): boolean {
  return canWriteOperational(role);
}

export function canWriteAreaNoticesForArea(
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
