import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";
import { handleRecoveryFlagPost } from "./handler";

/**
 * Marks an authenticated Supabase recovery session after a same-origin browser
 * recovery event. No client-provided token, role, or scope is accepted.
 */
export async function POST(request: Request) {
  return handleRecoveryFlagPost(request, {
    cookieName: RECOVERY_COOKIE,
    secureCookie: process.env.NODE_ENV === "production",
    async hasAuthenticatedUser() {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      return !error && Boolean(user);
    },
  });
}
