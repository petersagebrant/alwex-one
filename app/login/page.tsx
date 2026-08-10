import type { Metadata } from "next";
import Link from "next/link";
import { signInAction } from "./actions";

export const metadata: Metadata = {
  title: "Logga in | Alwex One",
  description: "Logga in till Alwex One",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;
  const message = params.message;
  const next = params.next?.startsWith("/") ? params.next : "/";

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[#f7f8fa] px-4 py-12 text-neutral-900">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-8">
        <div className="mb-6">
          <p className="text-[13px] font-semibold tracking-[0.08em] text-neutral-900 uppercase">
            Alwex One
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
            Logga in
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Använd ditt Supabase-konto för att fortsätta.
          </p>
        </div>

        {message ? (
          <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        <form action={signInAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

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
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-neutral-500"
              >
                Lösenord
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
              >
                Glömt lösenord?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
            />
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Logga in
          </button>
        </form>
      </div>
    </div>
  );
}
