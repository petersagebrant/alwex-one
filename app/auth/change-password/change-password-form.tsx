"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signOutAction } from "@/app/login/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/must-change-password";
import { changePasswordAction } from "./actions";

type ChangePasswordFormProps = {
  initialError?: string | null;
  requireCurrentPassword: boolean;
  forced: boolean;
};

export function ChangePasswordForm({
  initialError = null,
  requireCurrentPassword,
  forced,
}: ChangePasswordFormProps) {
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const displayError = clientError || initialError;

  function handleSubmit(formData: FormData) {
    setClientError(null);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (requireCurrentPassword && !currentPassword) {
      setClientError("Ange nuvarande lösenord.");
      return;
    }

    if (!password || !confirmPassword) {
      setClientError("Fyll i båda lösenordsfälten.");
      return;
    }

    if (password !== confirmPassword) {
      setClientError("Lösenorden matchar inte.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setClientError(
        `Lösenordet måste vara minst ${MIN_PASSWORD_LENGTH} tecken.`,
      );
      return;
    }

    startTransition(() => {
      void changePasswordAction(formData);
    });
  }

  return (
    <div className="space-y-4">
      <form action={handleSubmit} className="space-y-4">
        {displayError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {displayError}
          </p>
        ) : null}

        {requireCurrentPassword ? (
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-xs font-medium text-neutral-500"
            >
              Nuvarande lösenord
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
            />
          </div>
        ) : null}

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-neutral-500"
          >
            Nytt lösenord
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-medium text-neutral-500"
          >
            Bekräfta nytt lösenord
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Sparar…" : "Spara nytt lösenord"}
        </button>
      </form>

      <div className="flex flex-col items-center gap-2 pt-1 text-center text-sm text-neutral-500">
        {forced ? null : (
          <Link
            href="/"
            className="font-medium text-neutral-800 underline-offset-2 hover:underline"
          >
            Tillbaka
          </Link>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            className="font-medium text-neutral-800 underline-offset-2 hover:underline"
          >
            Logga ut
          </button>
        </form>
      </div>
    </div>
  );
}
