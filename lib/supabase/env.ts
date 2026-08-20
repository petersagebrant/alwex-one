/**
 * Reads Supabase public env vars.
 *
 * IMPORTANT: Access NEXT_PUBLIC_* keys via static property paths
 * (process.env.NEXT_PUBLIC_FOO), not process.env[name]. Next.js only
 * inlines statically referenced public env vars into the browser bundle.
 * Dynamic lookup breaks client components such as AuthRecoveryGate.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error(
      "Saknad miljövariabel: NEXT_PUBLIC_SUPABASE_URL. " +
        "Kopiera .env.local.example till .env.local och fyll i värdena från ditt Supabase-projekt.",
    );
  }

  if (!publishableKey) {
    throw new Error(
      "Saknad miljövariabel: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Kopiera .env.local.example till .env.local och fyll i värdena från ditt Supabase-projekt.",
    );
  }

  return {
    url,
    publishableKey,
  };
}
