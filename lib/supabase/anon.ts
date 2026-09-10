import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/** Cookie-less anon client for public /rapportera. Never uses the service role. */
export function createAnonClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
