import { canWriteOperational, type AppRole } from "@/lib/auth/roles";

/**
 * Matches RLS can_read_business_area: VD / Vice VD / admin / läsbehörighet
 * see all areas; AO-chef own area only.
 */
export function canReadOperationalReport(
  role: AppRole,
  profileBusinessAreaId: string | null,
  reportBusinessAreaId: string,
): boolean {
  if (role === "ao_chef") {
    return profileBusinessAreaId === reportBusinessAreaId;
  }
  return (
    role === "vd" ||
    role === "vice_vd" ||
    role === "administrator" ||
    role === "lasbehorighet"
  );
}

/**
 * Matches RLS can_write_operational: VD / Vice VD / admin all areas,
 * AO-chef own area, läsbehörighet none.
 */
export function canWriteOperationalForArea(
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

export function canUpdateOperationalReportStatus(
  role: AppRole,
  profileBusinessAreaId: string | null,
  reportBusinessAreaId: string,
): boolean {
  return canWriteOperationalForArea(
    role,
    profileBusinessAreaId,
    reportBusinessAreaId,
  );
}
