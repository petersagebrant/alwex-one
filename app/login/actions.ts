"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: FormDataEntryValue | null): string {
  const next = String(value ?? "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  if (next === "/login" || next.startsWith("/login/")) {
    return "/";
  }
  return next;
}

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

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    redirect(
      `/login?error=${encodeURIComponent("E-post och lösenord krävs.")}&next=${encodeURIComponent(next)}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }

  // Normal login must not keep a stale recovery gate.
  await clearRecoveryCookie();
  redirect(next);
}

export async function signOutAction() {
  const supabase = await createClient();
  await clearRecoveryCookie();
  await supabase.auth.signOut();
  redirect("/login");
}
