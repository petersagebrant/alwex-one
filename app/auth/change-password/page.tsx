import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginRedirectHref } from "@/lib/auth/deny-redirect";
import { mustChangePasswordFromUser } from "@/lib/auth/must-change-password";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "Byt lösenord",
  description: "Välj ett eget lösenord för ditt LEIR-konto",
};

type ChangePasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(loginRedirectHref("Logga in för att byta lösenord."));
  }

  const forced = mustChangePasswordFromUser(user);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[#f7f8fa] px-4 py-12 text-neutral-900">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-8">
        <div className="mb-6">
          <p className="text-[13px] font-semibold tracking-[0.08em] text-neutral-900 uppercase">
            LEIR
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
            {forced ? "Välj ditt lösenord" : "Byt lösenord"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {forced
              ? "Du loggade in med ett tillfälligt lösenord. Välj ett eget innan du kan använda LEIR."
              : "Ange nuvarande lösenord och välj ett nytt."}
          </p>
        </div>

        <ChangePasswordForm
          initialError={params.error ?? null}
          requireCurrentPassword={!forced}
          forced={forced}
        />
      </div>
    </div>
  );
}
