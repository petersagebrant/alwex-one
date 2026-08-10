import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordResetAction } from "./actions";

export const metadata: Metadata = {
  title: "Glömt lösenord | Alwex One",
  description: "Begär en länk för att återställa ditt lösenord",
};

type ForgotPasswordPageProps = {
  searchParams: Promise<{ error?: string; sent?: string; email?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const error = params.error;
  const sent = params.sent === "1";
  const email = params.email?.trim() || "";

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[#f7f8fa] px-4 py-12 text-neutral-900">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-8">
        <div className="mb-6">
          <p className="text-[13px] font-semibold tracking-[0.08em] text-neutral-900 uppercase">
            Alwex One
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
            Glömt lösenord
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Ange din e-postadress så skickar vi en länk för att välja ett nytt
            lösenord.
          </p>
        </div>

        {error ? (
          <p className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        {sent ? (
          <div className="space-y-5">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Om det finns ett konto för{" "}
              {email ? <strong>{email}</strong> : "den adressen"} skickar vi en
              återställningslänk. Öppna länken i mailet för att välja ett nytt
              lösenord.
            </p>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Tillbaka till inloggning
            </Link>
          </div>
        ) : (
          <form action={requestPasswordResetAction} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-neutral-500"
              >
                E-post
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                defaultValue={email}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              />
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Skicka återställningslänk
            </button>

            <p className="text-center text-sm text-neutral-500">
              <Link
                href="/login"
                className="font-medium text-neutral-800 underline-offset-2 hover:underline"
              >
                Tillbaka till inloggning
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
