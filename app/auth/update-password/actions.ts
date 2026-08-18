"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 8;

async function clearRecoveryCookie() {
  const cookieStore = await cookies();
  cookieStore.set(RECOVERY_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || !confirmPassword) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent("Fyll i båda lösenordsfälten.")}`,
    );
  }

  if (password !== confirmPassword) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent("Lösenorden matchar inte.")}`,
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent(`Lösenordet måste vara minst ${MIN_PASSWORD_LENGTH} tecken.`)}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      `/auth/update-password?error=${encodeURIComponent("Länken för lösenordsåterställning är ogiltig eller har gått ut. Begär en ny länk.")}`,
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.log("[auth-recovery] updateUser failed", { hasError: true });
    redirect(
      `/auth/update-password?error=${encodeURIComponent(error.message)}`,
    );
  }

  console.log("[auth-recovery] updateUser ok — signing out and clearing recovery flag");
  await clearRecoveryCookie();
  await supabase.auth.signOut();

  redirect(
    `/login?message=${encodeURIComponent("Lösenordet är uppdaterat. Logga in med ditt nya lösenord.")}`,
  );
}
