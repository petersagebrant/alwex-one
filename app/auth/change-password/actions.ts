"use server";

import { redirect } from "next/navigation";
import {
  CHANGE_PASSWORD_PATH,
  MIN_PASSWORD_LENGTH,
  mustChangePasswordFromUser,
} from "@/lib/auth/must-change-password";
import { loginRedirectHref } from "@/lib/auth/deny-redirect";
import { createClient } from "@/lib/supabase/server";
import { clearMustChangePasswordFlag } from "@/services/users";

function fail(message: string): never {
  redirect(`${CHANGE_PASSWORD_PATH}?error=${encodeURIComponent(message)}`);
}

export async function changePasswordAction(formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || !confirmPassword) {
    fail("Fyll i båda lösenordsfälten.");
  }

  if (password !== confirmPassword) {
    fail("Lösenorden matchar inte.");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Lösenordet måste vara minst ${MIN_PASSWORD_LENGTH} tecken.`);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(loginRedirectHref("Logga in för att byta lösenord."));
  }

  const mustChange = mustChangePasswordFromUser(user);

  if (!mustChange) {
    if (!currentPassword) {
      fail("Ange nuvarande lösenord.");
    }
    if (!user.email) {
      fail("Kontot saknar e-postadress. Kontakta administratör.");
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      fail("Nuvarande lösenord stämmer inte.");
    }
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    fail("Kunde inte spara det nya lösenordet. Försök igen.");
  }

  await clearMustChangePasswordFlag(user.id);
  await supabase.auth.refreshSession();

  redirect("/");
}
