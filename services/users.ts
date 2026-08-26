import "server-only";

import { headers } from "next/headers";
import { isProtectedUserId } from "@/lib/auth/protected-users";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import {
  assertActorMayChangeTarget,
  assertActorMaySetPassword,
  parseInviteUserInput,
  parseUpdateUserInput,
  type InviteUserInput,
} from "@/lib/auth/user-admin";
import { APP_ROLE_LABELS, type AppRole } from "@/lib/auth/roles";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/services/auditLog";
import { resolveActorName } from "@/services/changeHistory";
import {
  fetchAllProfilesForAdmin,
  insertProfile,
  setProfileDisabledAt,
  updateProfileRow,
  type ProfileRow,
} from "@/lib/supabase/profiles";

const AUTH_BAN_DURATION = "876000h";

export type AdminUserListItem = {
  id: string;
  displayName: string;
  rawDisplayName: string;
  email: string | null;
  role: AppRole;
  roleLabel: string;
  businessAreaId: string | null;
  businessAreaName: string | null;
  status: "active" | "inactive";
  invitedPending: boolean;
  protected: boolean;
  isSelf: boolean;
};

function appOriginFromHeaders(headerStore: Headers): string {
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost || headerStore.get("host");
  if (!host) {
    return "";
  }

  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol =
    forwardedProto ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${protocol}://${host}`;
}

async function authRedirectTo(): Promise<string> {
  const origin = appOriginFromHeaders(await headers());
  if (!origin) {
    throw new Error("Kunde inte avgöra webbadress. Försök igen.");
  }
  return `${origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`;
}

type AuthUserSummary = {
  id: string;
  email: string | null;
  emailConfirmedAt: string | null;
  invitedAt: string | null;
};

async function listAuthUsers(): Promise<AuthUserSummary[]> {
  const admin = createServiceRoleClient();
  const users: AuthUserSummary[] = [];
  const perPage = 200;
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Kunde inte hämta e-postadresser: ${error.message}`);
    }

    const batch = data.users ?? [];
    for (const user of batch) {
      users.push({
        id: user.id,
        email: user.email ?? null,
        emailConfirmedAt: user.email_confirmed_at ?? null,
        invitedAt: user.invited_at ?? null,
      });
    }

    if (batch.length < perPage) {
      break;
    }
    page += 1;
  }

  return users;
}

async function findAuthUserByEmail(
  email: string,
): Promise<AuthUserSummary | null> {
  const users = await listAuthUsers();
  const needle = email.trim().toLowerCase();
  return (
    users.find((user) => (user.email ?? "").trim().toLowerCase() === needle) ??
    null
  );
}

export async function getAdminUsers(options: {
  actorId: string;
  areaNames: Map<string, string>;
}): Promise<AdminUserListItem[]> {
  const [profiles, authUsers] = await Promise.all([
    fetchAllProfilesForAdmin(),
    listAuthUsers(),
  ]);

  const emailById = new Map(authUsers.map((user) => [user.id, user]));

  return profiles.map((profile) => {
    const authUser = emailById.get(profile.id);
    return toListItem(profile, authUser ?? null, options);
  });
}

function toListItem(
  profile: ProfileRow,
  authUser: AuthUserSummary | null,
  options: { actorId: string; areaNames: Map<string, string> },
): AdminUserListItem {
  const invitedPending = Boolean(
    authUser && !authUser.emailConfirmedAt && authUser.invitedAt,
  );

  return {
    id: profile.id,
    displayName: profile.display_name.trim() || authUser?.email || "Namnlös",
    rawDisplayName: profile.display_name,
    email: authUser?.email ?? null,
    role: profile.role,
    roleLabel: APP_ROLE_LABELS[profile.role],
    businessAreaId: profile.business_area_id,
    businessAreaName: profile.business_area_id
      ? (options.areaNames.get(profile.business_area_id) ?? "Okänt område")
      : null,
    status: profile.disabled_at ? "inactive" : "active",
    invitedPending,
    protected: isProtectedUserId(profile.id),
    isSelf: profile.id === options.actorId,
  };
}

export async function inviteUser(
  _actorId: string,
  raw: {
    displayName: unknown;
    email: unknown;
    role: unknown;
    businessAreaId: unknown;
  },
): Promise<void> {
  const parsed = parseInviteUserInput(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const existing = await findAuthUserByEmail(parsed.value.email);
  if (existing) {
    const profiles = await fetchAllProfilesForAdmin();
    if (profiles.some((profile) => profile.id === existing.id)) {
      throw new Error("En användare med den e-postadressen finns redan.");
    }
    await insertProfile({
      id: existing.id,
      role: parsed.value.role,
      businessAreaId: parsed.value.businessAreaId,
      displayName: parsed.value.displayName,
    });
    await sendInviteOrRecoveryLink(existing);
    return;
  }

  const userId = await inviteAuthUser(parsed.value);
  try {
    await insertProfile({
      id: userId,
      role: parsed.value.role,
      businessAreaId: parsed.value.businessAreaId,
      displayName: parsed.value.displayName,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `${error.message} Auth-kontot skapades; komplettera profilen eller försök igen.`
        : "Kunde inte spara profil efter inbjudan.",
    );
  }
}

async function inviteAuthUser(input: InviteUserInput): Promise<string> {
  const admin = createServiceRoleClient();
  const redirectTo = await authRedirectTo();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { display_name: input.displayName },
    redirectTo,
  });

  if (error || !data.user?.id) {
    throw new Error(
      error?.message
        ? `Kunde inte skicka inbjudan: ${error.message}`
        : "Kunde inte skicka inbjudan.",
    );
  }

  return data.user.id;
}

async function sendInviteOrRecoveryLink(user: AuthUserSummary): Promise<void> {
  if (!user.email) {
    throw new Error("Användaren saknar e-postadress.");
  }

  const admin = createServiceRoleClient();
  const redirectTo = await authRedirectTo();
  const type =
    user.emailConfirmedAt || !user.invitedAt ? "recovery" : "invite";

  const { error } = await admin.auth.admin.generateLink({
    type,
    email: user.email,
    options: { redirectTo },
  });

  if (error) {
    throw new Error(`Kunde inte skicka länk: ${error.message}`);
  }
}

export async function updateUser(
  actorId: string,
  raw: {
    id: unknown;
    displayName: unknown;
    role: unknown;
    businessAreaId: unknown;
  },
): Promise<void> {
  const parsed = parseUpdateUserInput(raw);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const current = await requireExistingProfile(parsed.value.id);
  const changingRole = current.role !== parsed.value.role;
  const changingArea = current.business_area_id !== parsed.value.businessAreaId;

  const allowed = assertActorMayChangeTarget({
    actorId,
    targetId: parsed.value.id,
    changingRole,
    changingArea,
    disabling: false,
  });
  if (!allowed.ok) {
    throw new Error(allowed.error);
  }

  await updateProfileRow({
    id: parsed.value.id,
    role: parsed.value.role,
    businessAreaId: parsed.value.businessAreaId,
    displayName: parsed.value.displayName,
  });
}

export async function setUserDisabled(
  actorId: string,
  userId: string,
  disabled: boolean,
): Promise<void> {
  const allowed = assertActorMayChangeTarget({
    actorId,
    targetId: userId,
    changingRole: false,
    changingArea: false,
    disabling: true,
  });
  if (!allowed.ok) {
    throw new Error(allowed.error);
  }

  await requireExistingProfile(userId);

  const admin = createServiceRoleClient();

  if (disabled) {
    await setProfileDisabledAt(userId, new Date().toISOString());
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: AUTH_BAN_DURATION,
    });
    if (error) {
      throw new Error(
        `Kontot inaktiverades i LEIR men Auth-spärr misslyckades: ${error.message}`,
      );
    }
    return;
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (error) {
    throw new Error(`Kunde inte ta bort Auth-spärr: ${error.message}`);
  }
  await setProfileDisabledAt(userId, null);
}

export async function sendUserAccessLink(
  actorId: string,
  userId: string,
): Promise<void> {
  if (actorId === userId) {
    throw new Error("Begär en återställningslänk via Glömt lösenord? för ditt eget konto.");
  }

  const profile = await requireExistingProfile(userId);
  if (profile.disabled_at) {
    throw new Error("Aktivera kontot innan du skickar en ny länk.");
  }

  const authUsers = await listAuthUsers();
  const authUser = authUsers.find((user) => user.id === userId);
  if (!authUser) {
    throw new Error("Auth-kontot hittades inte.");
  }

  await sendInviteOrRecoveryLink(authUser);
}

export async function setUserTemporaryPassword(
  actorId: string,
  userId: string,
): Promise<{ password: string; email: string | null }> {
  const allowed = assertActorMaySetPassword({ actorId, targetId: userId });
  if (!allowed.ok) {
    throw new Error(allowed.error);
  }

  const profile = await requireExistingProfile(userId);
  const authUsers = await listAuthUsers();
  const authUser = authUsers.find((user) => user.id === userId);
  if (!authUser) {
    throw new Error("Auth-kontot hittades inte.");
  }

  const password = generateTemporaryPassword();
  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (error) {
    throw new Error(`Kunde inte ange nytt lösenord: ${error.message}`);
  }

  const actorName = await resolveActorName();
  const targetEmail = authUser.email;
  await recordAuditLog({
    entityType: "user",
    entityId: userId,
    action: "password_reset",
    description: "Administrativ lösenordsåterställning",
    actorName,
    businessAreaId: profile.business_area_id,
    changes: {
      fields: [
        { field: "actor_id", from: null, to: actorId },
        { field: "target_user_id", from: null, to: userId },
        { field: "target_email", from: null, to: targetEmail },
      ],
    },
  });

  return { password, email: targetEmail };
}

async function requireExistingProfile(userId: string): Promise<ProfileRow> {
  const profiles = await fetchAllProfilesForAdmin();
  const profile = profiles.find((row) => row.id === userId);
  if (!profile) {
    throw new Error("Användaren hittades inte.");
  }
  return profile;
}
