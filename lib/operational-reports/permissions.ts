import {
  canWriteOperational,
  isVdEquivalent,
  type AppRole,
} from "@/lib/auth/roles";
import { hasAnsweredEscalation } from "@/lib/operational-reports/escalation";
import type { ActivityEscalation } from "@/types/activity-escalation";

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

/** AO-chef own area; VD / Vice VD / admin all areas. */
export function canEscalateActivity(
  role: AppRole,
  profileBusinessAreaId: string | null,
  areaId: string,
): boolean {
  return canWriteOperationalForArea(role, profileBusinessAreaId, areaId);
}

/**
 * Only VD / Vice VD, plus admin via existing write-all-areas pattern.
 * AO-chef cannot answer.
 */
export function canAnswerEscalation(role: AppRole): boolean {
  return isVdEquivalent(role) || role === "administrator";
}

/** Company-wide unanswered list: VD and Vice VD only. Not AO-chef or admin. */
export function canViewLeadershipEscalations(role: AppRole): boolean {
  return isVdEquivalent(role);
}

export function canReadActivityEscalation(
  role: AppRole,
  profileBusinessAreaId: string | null,
  activityBusinessAreaId: string,
): boolean {
  return canReadOperationalReport(
    role,
    profileBusinessAreaId,
    activityBusinessAreaId,
  );
}

/**
 * After leadership answers an AO follow-up, only the area AO-chef closes it.
 * VD / Vice VD keep write access for escalate/answer, but not Klar on the board.
 */
export function canCompleteFollowUpActivity(input: {
  role: AppRole;
  profileBusinessAreaId: string | null;
  activityBusinessAreaId: string;
  escalations: Array<{ status: ActivityEscalation["status"] }>;
}): boolean {
  if (
    !canWriteOperationalForArea(
      input.role,
      input.profileBusinessAreaId,
      input.activityBusinessAreaId,
    )
  ) {
    return false;
  }
  if (isVdEquivalent(input.role) && hasAnsweredEscalation(input.escalations)) {
    return false;
  }
  return true;
}
