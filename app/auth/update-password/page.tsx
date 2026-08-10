import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = {
  title: "Nytt lösenord | Alwex One",
  description: "Välj ett nytt lösenord för ditt Alwex One-konto",
};

type UpdatePasswordPageProps = {
  searchParams: Promise<{
    error?: string;
    code?: string;
    token_hash?: string;
    type?: string;
  }>;
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const params = await searchParams;

  // Some Supabase templates redirect straight here with ?code= / token_hash —
  // exchange via callback so recovery never lands on Dashboard.
  if (params.code) {
    redirect(
      `/auth/callback?code=${encodeURIComponent(params.code)}&next=${encodeURIComponent("/auth/update-password")}`,
    );
  }

  if (params.token_hash && params.type) {
    redirect(
      `/auth/callback?token_hash=${encodeURIComponent(params.token_hash)}&type=${encodeURIComponent(params.type)}&next=${encodeURIComponent("/auth/update-password")}`,
    );
  }

  const initialError = params.error ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[#f7f8fa] px-4 py-12 text-neutral-900">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-8">
        <div className="mb-6">
          <p className="text-[13px] font-semibold tracking-[0.08em] text-neutral-900 uppercase">
            Alwex One
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
            Välj nytt lösenord
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Ange och bekräfta ditt nya lösenord för att slutföra
            återställningen.
          </p>
        </div>

        <UpdatePasswordForm
          initialError={initialError}
          hasServerSession={Boolean(user)}
        />
      </div>
    </div>
  );
}
