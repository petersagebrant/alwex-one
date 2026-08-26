"use client";

import { useState, useTransition } from "react";
import { setUserPasswordAction } from "@/app/admin/users/actions";

type SetUserPasswordControlsProps = {
  userId: string;
  displayName: string;
  email: string | null;
};

export function SetUserPasswordControls({
  userId,
  displayName,
  email,
}: SetUserPasswordControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function closeAll() {
    if (isPending) {
      return;
    }
    setConfirmOpen(false);
    setPassword(null);
    setError(null);
    setCopied(false);
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await setUserPasswordAction(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
      setCopied(false);
      setPassword(result.password);
    });
  }

  async function copyPassword() {
    if (!password) {
      return;
    }
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);
          setPassword(null);
          setCopied(false);
          setConfirmOpen(true);
        }}
        className="text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
      >
        Ange nytt lösenord
      </button>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`set-password-dialog-title-${userId}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            closeAll();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={`set-password-dialog-title-${userId}`}
              className="text-base font-semibold text-neutral-900"
            >
              Ange nytt lösenord?
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Detta ersätter det nuvarande lösenordet för{" "}
              <span className="font-medium text-neutral-900">{displayName}</span>
              {email ? ` (${email})` : null}. Användaren får ingen e-post.
            </p>

            {error ? (
              <p className="mt-3 text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={closeAll}
                className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                className="rounded-xl bg-[#111827] px-3.5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {isPending ? "Skapar…" : "OK"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {password ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`new-password-dialog-title-${userId}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            closeAll();
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={`new-password-dialog-title-${userId}`}
              className="text-base font-semibold text-neutral-900"
            >
              Nytt tillfälligt lösenord
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Visas bara en gång. Kopiera och lämna till användaren — det sparas
              inte.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={password}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm text-neutral-900"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => {
                  void copyPassword();
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {copied ? "Kopierat" : "Kopiera"}
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeAll}
                className="rounded-xl bg-[#111827] px-3.5 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
