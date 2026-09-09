import { canWriteOperational, isVdEquivalent, type AppRole } from "@/lib/auth/roles";

/**
 * Who may create/edit/archive Aktuellt in the UI.
 * Area-scoped matches RLS can_write_operational: VD/admin all areas,
 * AO-chef own area, lasbehorighet none.
 * Org-wide (business_area_id null) is only vd / vice_vd (isVdEquivalent),
 * not administrator — Peter: same capability for VD and Vice VD only.
 * Read is org-wide for every authenticated user.
 */
export function canWriteAreaNotices(role: AppRole): boolean {
  return canWriteOperational(role);
}

export function canWriteOrganizationWideNotices(role: AppRole): boolean {
  return isVdEquivalent(role);
}

export function canWriteAreaNoticesForArea(
  role: AppRole,
  profileBusinessAreaId: string | null,
  areaId: string | null,
): boolean {
  if (areaId == null) {
    return canWriteOrganizationWideNotices(role);
  }
  if (!canWriteOperational(role)) {
    return false;
  }
  if (role === "ao_chef") {
    return profileBusinessAreaId === areaId;
  }
  return true;
}
