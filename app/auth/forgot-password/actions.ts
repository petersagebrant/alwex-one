"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(
      `/auth/forgot-password?error=${encodeURIComponent("Ange din e-postadress.")}`,
    );
  }

  const headerStore = await headers();
  const origin = appOriginFromHeaders(headerStore);
  if (!origin) {
    redirect(
      `/auth/forgot-password?error=${encodeURIComponent("Kunde inte avgöra webbadress. Försök igen.")}`,
    );
  }

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    redirect(
      `/auth/forgot-password?error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect(
    `/auth/forgot-password?sent=1&email=${encodeURIComponent(email)}`,
  );
}
