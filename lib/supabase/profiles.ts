import { createClient } from "@/lib/supabase/server";
import { isAppRole, type AppRole } from "@/lib/auth/roles";

const PROFILE_COLUMNS =
  "id, role, business_area_id, display_name, disabled_at, created_at, updated_at";

export type ProfileRow = {
  id: string;
  role: AppRole;
  business_area_id: string | null;
  display_name: string;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapProfileRow(data: {
  id: string;
  role: string;
  business_area_id: string | null;
  display_name: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
}): ProfileRow | null {
  if (!isAppRole(data.role)) {
    return null;
  }

  return {
    id: data.id,
    role: data.role,
    business_area_id: data.business_area_id,
    display_name: data.display_name ?? "",
    disabled_at: data.disabled_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Active profile for the signed-in user. Disabled accounts are treated as
 * missing so helpers fail closed.
 */
export async function fetchProfileByUserId(
  userId: string,
): Promise<ProfileRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta profil: ${error.message}`);
  }

  if (!data || data.disabled_at) {
    return null;
  }

  return mapProfileRow(data);
}

export async function fetchAllProfilesForAdmin(): Promise<ProfileRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta användare: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => mapProfileRow(row))
    .filter((row): row is ProfileRow => row !== null);
}

/** Active profiles visible to operational writers (goal owner picker). */
export async function fetchActiveProfilesForAssignment(): Promise<
  ProfileRow[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .is("disabled_at", null)
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta användare: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => mapProfileRow(row))
    .filter((row): row is ProfileRow => row !== null);
}

export async function fetchProfileById(
  userId: string,
): Promise<ProfileRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta profil: ${error.message}`);
  }

  if (!data || data.disabled_at) {
    return null;
  }

  return mapProfileRow(data);
}

export async function insertProfile(input: {
  id: string;
  role: AppRole;
  businessAreaId: string | null;
  displayName: string;
}): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("profiles").insert({
    id: input.id,
    role: input.role,
    business_area_id: input.businessAreaId,
    display_name: input.displayName,
    disabled_at: null,
  });

  if (error) {
    throw new Error(`Kunde inte spara profil: ${error.message}`);
  }
}

export async function updateProfileRow(input: {
  id: string;
  role: AppRole;
  businessAreaId: string | null;
  displayName: string;
}): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      role: input.role,
      business_area_id: input.businessAreaId,
      display_name: input.displayName,
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(`Kunde inte uppdatera profil: ${error.message}`);
  }
}

export async function setProfileDisabledAt(
  userId: string,
  disabledAt: string | null,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ disabled_at: disabledAt })
    .eq("id", userId);

  if (error) {
    throw new Error(`Kunde inte uppdatera status: ${error.message}`);
  }
}
