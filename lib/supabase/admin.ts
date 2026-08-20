import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Auth Admin API client (invite, list users, generateLink, ban).
 * Never import from Client Components. Do not expose this key to the browser.
 */
export function createServiceRoleClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Saknad miljövariabel: SUPABASE_SERVICE_ROLE_KEY. " +
        "Nyckeln är server-only — lägg den i .env.local (lokalt) eller Vercel (hosted).",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
