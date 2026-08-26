import type { AppRole } from "../auth/roles";
import { isVdEquivalent } from "../auth/roles";

export type AiPrincipal =
  | {
      userId: string;
      email: string | null;
      role: "vd" | "vice_vd";
      scope: "organization";
      businessAreaId: null;
    }
  | {
      userId: string;
      email: string | null;
      role: "ao_chef";
      scope: "business_area";
      businessAreaId: string;
    };

export type AiProfile = {
  id: string;
  role: AppRole;
  businessAreaId: string | null;
};

export class AiAccessError extends Error {
  constructor(message = "Du saknar behörighet att använda AI-funktionen.") {
    super(message);
    this.name = "AiAccessError";
  }
}

export function resolveAiPrincipal(
  user: { id: string; email: string | null } | null,
  profile: AiProfile | null,
): AiPrincipal {
  if (!user || !profile || profile.id !== user.id) {
    throw new AiAccessError();
  }
  if (isVdEquivalent(profile.role)) {
    return {
      userId: user.id,
      email: user.email,
      role: profile.role,
      scope: "organization",
      businessAreaId: null,
    };
  }
  if (profile.role === "ao_chef" && profile.businessAreaId) {
    return {
      userId: user.id,
      email: user.email,
      role: "ao_chef",
      scope: "business_area",
      businessAreaId: profile.businessAreaId,
    };
  }
  throw new AiAccessError();
}

export function requireVdPrincipal(principal: AiPrincipal): asserts principal is Extract<
  AiPrincipal,
  { role: "vd" | "vice_vd" }
> {
  if (!isVdEquivalent(principal.role)) {
    throw new AiAccessError("VD Briefing är endast tillgänglig för VD.");
  }
}

export function aiScopeKey(principal: AiPrincipal): string {
  return principal.scope === "organization"
    ? "organization"
    : `business-area:${principal.businessAreaId}`;
}

export function assertRowsInAiScope<T extends { businessAreaId: string }>(
  principal: AiPrincipal,
  rows: readonly T[],
  label: string,
): void {
  if (isVdEquivalent(principal.role)) return;
  if (rows.some((row) => row.businessAreaId !== principal.businessAreaId)) {
    throw new AiAccessError(`Säkerhetskontroll misslyckades för ${label}.`);
  }
}

export function assertAreaIdsInAiScope(
  principal: AiPrincipal,
  areaIds: readonly (string | null)[],
  label: string,
): void {
  if (isVdEquivalent(principal.role)) return;
  if (areaIds.some((id) => id !== principal.businessAreaId)) {
    throw new AiAccessError(`Säkerhetskontroll misslyckades för ${label}.`);
  }
}
