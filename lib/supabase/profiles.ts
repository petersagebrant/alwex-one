import { createClient } from "@/lib/supabase/server";
import { isAppRole, type AppRole } from "@/lib/auth/roles";

export type ProfileRow = {
  id: string;
  role: AppRole;
  business_area_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchProfileByUserId(
  userId: string,
): Promise<ProfileRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, business_area_id, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta profil: ${error.message}`);
  }

  if (!data || !isAppRole(data.role)) {
    return null;
  }

  return {
    id: data.id,
    role: data.role,
    business_area_id: data.business_area_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}
