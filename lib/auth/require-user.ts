import { redirect } from "next/navigation";
import {
  canAdministerUsers,
  canManageBusinessAreas,
  canWriteDecisions,
  canWriteOperational,
  type AppRole,
} from "@/lib/auth/roles";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { createClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthProfile = AuthUser & {
  role: AppRole;
  businessAreaId: string | null;
};

/**
 * Ensures the caller is signed in. Redirects to /login otherwise.
 * Use in Server Actions and protected Server Components.
 */
export async function requireUser(): Promise<AuthUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}

/** Returns the current user or null when signed out. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}

/**
 * Ensures the caller is signed in and has a profiles row (role assignment).
 */
export async function requireProfile(): Promise<AuthProfile> {
  const user = await requireUser();
  const profile = await fetchProfileByUserId(user.id);

  if (!profile) {
    redirect(
      `/login?error=${encodeURIComponent(
        "Inget konto med tilldelad roll. Kontakta administratör.",
      )}`,
    );
  }

  return {
    id: user.id,
    email: user.email,
    role: profile.role,
    businessAreaId: profile.business_area_id,
  };
}

function deny(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

/** KPI, mål, aktiviteter (VD / AO-chef / Administratör). */
export async function requireOperationalWriter(): Promise<AuthProfile> {
  const profile = await requireProfile();
  if (!canWriteOperational(profile.role)) {
    deny("Du saknar behörighet att skapa eller redigera denna data.");
  }
  return profile;
}

/** Beslut (VD / Administratör). */
export async function requireDecisionWriter(): Promise<AuthProfile> {
  const profile = await requireProfile();
  if (!canWriteDecisions(profile.role)) {
    deny("Du saknar behörighet att skapa eller redigera beslut.");
  }
  return profile;
}

/** Affärsområden (VD / Administratör). */
export async function requireBusinessAreaManager(): Promise<AuthProfile> {
  const profile = await requireProfile();
  if (!canManageBusinessAreas(profile.role)) {
    deny("Du saknar behörighet att administrera affärsområden.");
  }
  return profile;
}

/** Användarinställningar / profiler (Administratör). */
export async function requireUserAdministrator(): Promise<AuthProfile> {
  const profile = await requireProfile();
  if (!canAdministerUsers(profile.role)) {
    deny("Du saknar behörighet att administrera användare.");
  }
  return profile;
}
