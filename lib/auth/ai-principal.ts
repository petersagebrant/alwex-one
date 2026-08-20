import "server-only";

import { resolveAiPrincipal, requireVdPrincipal as assertVdPrincipal } from "@/lib/ai/security";
import { isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type { AiPrincipal } from "@/lib/ai/security";

export async function requireAiPrincipal() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return resolveAiPrincipal(null, null);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, business_area_id, disabled_at")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.id !== user.id ||
    !isAppRole(profile.role) ||
    profile.disabled_at
  ) {
    return resolveAiPrincipal(
      { id: user.id, email: user.email ?? null },
      null,
    );
  }

  return resolveAiPrincipal(
    { id: user.id, email: user.email ?? null },
    {
      id: profile.id,
      role: profile.role,
      businessAreaId: profile.business_area_id,
    },
  );
}

export async function requireVdAiPrincipal() {
  const principal = await requireAiPrincipal();
  assertVdPrincipal(principal);
  return principal;
}
