import { isAppRole, type AppRole } from "@/lib/auth/roles";
import {
  isProtectedUserId,
  protectedUserMutationError,
} from "@/lib/auth/protected-users";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DISPLAY_NAME_MAX_LENGTH = 120;

export type InviteUserInput = {
  displayName: string;
  email: string;
  role: AppRole;
  businessAreaId: string | null;
};

export type UpdateUserInput = {
  id: string;
  displayName: string;
  role: AppRole;
  businessAreaId: string | null;
};

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function parseDisplayName(value: unknown): ParseResult<string> {
  const displayName = asString(value).trim();
  if (!displayName) {
    return { ok: false, error: "Namn är obligatoriskt." };
  }
  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Namn får vara högst ${DISPLAY_NAME_MAX_LENGTH} tecken.`,
    };
  }
  return { ok: true, value: displayName };
}

function parseEmail(value: unknown): ParseResult<string> {
  const email = asString(value).trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "E-post är obligatorisk." };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Ogiltig e-postadress." };
  }
  return { ok: true, value: email };
}

function parseRoleAndArea(
  roleValue: unknown,
  areaValue: unknown,
): ParseResult<{ role: AppRole; businessAreaId: string | null }> {
  const roleRaw = asString(roleValue).trim();
  if (!isAppRole(roleRaw)) {
    return { ok: false, error: "Ogiltig roll." };
  }

  const areaRaw = asString(areaValue).trim();
  if (roleRaw === "ao_chef") {
    if (!areaRaw) {
      return {
        ok: false,
        error: "AO-chef måste tillhöra ett affärsområde.",
      };
    }
    if (!UUID_PATTERN.test(areaRaw)) {
      return { ok: false, error: "Ogiltigt affärsområde." };
    }
    return { ok: true, value: { role: roleRaw, businessAreaId: areaRaw } };
  }

  if (areaRaw) {
    return {
      ok: false,
      error: "Endast AO-chef får ha ett affärsområde.",
    };
  }

  return { ok: true, value: { role: roleRaw, businessAreaId: null } };
}

export function parseInviteUserInput(input: {
  displayName: unknown;
  email: unknown;
  role: unknown;
  businessAreaId: unknown;
}): ParseResult<InviteUserInput> {
  const name = parseDisplayName(input.displayName);
  if (!name.ok) return name;

  const email = parseEmail(input.email);
  if (!email.ok) return email;

  const roleArea = parseRoleAndArea(input.role, input.businessAreaId);
  if (!roleArea.ok) return roleArea;

  return {
    ok: true,
    value: {
      displayName: name.value,
      email: email.value,
      role: roleArea.value.role,
      businessAreaId: roleArea.value.businessAreaId,
    },
  };
}

export function parseUpdateUserInput(input: {
  id: unknown;
  displayName: unknown;
  role: unknown;
  businessAreaId: unknown;
}): ParseResult<UpdateUserInput> {
  const id = asString(input.id).trim();
  if (!id || !UUID_PATTERN.test(id)) {
    return { ok: false, error: "Saknar giltigt användar-id." };
  }

  const name = parseDisplayName(input.displayName);
  if (!name.ok) return name;

  const roleArea = parseRoleAndArea(input.role, input.businessAreaId);
  if (!roleArea.ok) return roleArea;

  return {
    ok: true,
    value: {
      id,
      displayName: name.value,
      role: roleArea.value.role,
      businessAreaId: roleArea.value.businessAreaId,
    },
  };
}

export function assertActorMayChangeTarget(options: {
  actorId: string;
  targetId: string;
  changingRole: boolean;
  changingArea: boolean;
  disabling: boolean;
}): ParseResult<true> {
  const { actorId, targetId, changingRole, changingArea, disabling } = options;

  if (actorId === targetId && (changingRole || changingArea || disabling)) {
    return {
      ok: false,
      error: disabling
        ? "Du kan inte ändra status på ditt eget konto."
        : "Du kan inte ändra din egen roll eller affärsområde.",
    };
  }

  if (disabling) {
    const protectedError = protectedUserMutationError(targetId, "disable");
    if (protectedError) {
      return { ok: false, error: protectedError };
    }
  }

  if (changingRole && isProtectedUserId(targetId)) {
    const protectedError = protectedUserMutationError(targetId, "role");
    if (protectedError) {
      return { ok: false, error: protectedError };
    }
  }

  return { ok: true, value: true };
}

export function assertActorMaySetPassword(options: {
  actorId: string;
  targetId: string;
}): ParseResult<true> {
  if (options.actorId === options.targetId) {
    return {
      ok: false,
      error: "Du kan inte ange nytt lösenord för ditt eget konto.",
    };
  }

  return { ok: true, value: true };
}
