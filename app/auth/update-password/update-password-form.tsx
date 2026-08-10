"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { updatePasswordAction } from "./actions";

type UpdatePasswordFormProps = {
  initialError?: string | null;
  hasServerSession: boolean;
};

export function UpdatePasswordForm({
  initialError = null,
  hasServerSession,
}: UpdatePasswordFormProps) {
  const [ready, setReady] = useState(hasServerSession);
  const [bootstrapping, setBootstrapping] = useState(!hasServerSession);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (hasServerSession) {
      setReady(true);
      setBootstrapping(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function establishRecoverySession() {
      try {
        // Implicit/hash recovery links land with tokens in the URL fragment.
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        if (hash.includes("access_token") || hash.includes("type=recovery")) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
              throw error;
            }
            console.log("[auth-recovery] update-password form setSession from hash");
            try {
              await fetch("/auth/recovery-flag", { method: "POST" });
            } catch {
              console.log("[auth-recovery] recovery-flag POST failed");
            }
            // Clean sensitive tokens from the address bar.
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${window.location.search}`,
            );
          }
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (cancelled) {
          return;
        }

        if (error || !user) {
          setSessionError(
            "Länken för lösenordsåterställning är ogiltig eller har gått ut. Begär en ny länk.",
          );
          setReady(false);
          return;
        }

        setReady(true);
        setSessionError(null);
      } catch {
        if (!cancelled) {
          setSessionError(
            "Länken för lösenordsåterställning är ogiltig eller har gått ut. Begär en ny länk.",
          );
          setReady(false);
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) {
        return;
      }
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setSessionError(null);
        setBootstrapping(false);
      }
    });

    void establishRecoverySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [hasServerSession]);

  const displayError = clientError || initialError || sessionError;

  function handleSubmit(formData: FormData) {
    setClientError(null);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!password || !confirmPassword) {
      setClientError("Fyll i båda lösenordsfälten.");
      return;
    }

    if (password !== confirmPassword) {
      setClientError("Lösenorden matchar inte.");
      return;
    }

    if (password.length < 8) {
      setClientError("Lösenordet måste vara minst 8 tecken.");
      return;
    }

    startTransition(() => {
      void updatePasswordAction(formData);
    });
  }

  if (bootstrapping) {
    return (
      <p className="text-sm text-neutral-500">
        Verifierar återställningslänken…
      </p>
    );
  }

  if (!ready) {
    return (
      <div className="space-y-5">
        {displayError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {displayError}
          </p>
        ) : (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Länken för lösenordsåterställning är ogiltig eller har gått ut. Begär
            en ny länk.
          </p>
        )}
        <Link
          href="/auth/forgot-password"
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          Begär ny återställningslänk
        </Link>
        <p className="text-center text-sm text-neutral-500">
          <Link
            href="/login"
            className="font-medium text-neutral-800 underline-offset-2 hover:underline"
          >
            Tillbaka till inloggning
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {displayError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {displayError}
        </p>
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
          minLength={8}
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
          minLength={8}
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
  );
}
