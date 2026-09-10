"use client";

import { useState, useTransition } from "react";
import { setUserPasswordAction } from "@/app/admin/users/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/must-change-password";

type SetUserPasswordControlsProps = {
  userId: string;
  displayName: string;
  email: string | null;
  label?: string;
  emphasis?: boolean;
  isSelf?: boolean;
};

export function SetUserPasswordControls({
  userId,
  displayName,
  email,
  label = "Ange nytt lösenord",
  emphasis = false,
  isSelf = false,
}: SetUserPasswordControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [ownDone, setOwnDone] = useState(false);
  const [ownPassword, setOwnPassword] = useState("");
  const [ownPasswordConfirm, setOwnPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function closeAll() {
    if (isPending) {
      return;
    }
    setConfirmOpen(false);
    setPassword(null);
    setOwnDone(false);
    setOwnPassword("");
    setOwnPasswordConfirm("");
    setError(null);
    setCopied(false);
  }

  function handleConfirm() {
    setError(null);

    if (isSelf) {
      if (!ownPassword || !ownPasswordConfirm) {
        setError("Fyll i båda lösenordsfälten.");
        return;
      }
      if (ownPassword !== ownPasswordConfirm) {
        setError("Lösenorden matchar inte.");
        return;
      }
      if (ownPassword.length < MIN_PASSWORD_LENGTH) {
        setError(`Lösenordet måste vara minst ${MIN_PASSWORD_LENGTH} tecken.`);
        return;
      }
    }

    startTransition(async () => {
      const result = isSelf
        ? await setUserPasswordAction(userId, ownPassword)
        : await setUserPasswordAction(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmOpen(false);
      setCopied(false);
      setOwnPassword("");
      setOwnPasswordConfirm("");
      if (result.mode === "own") {
        setOwnDone(true);
        setPassword(null);
        return;
      }
      setOwnDone(false);
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
          setOwnDone(false);
          setOwnPassword("");
          setOwnPasswordConfirm("");
          setCopied(false);
          setConfirmOpen(true);
        }}
        className={
          emphasis
            ? "inline-flex items-center justify-center rounded-xl bg-[#111827] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            : "text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
        }
      >
        {label}
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
              {isSelf ? "Byt lösenord på ditt konto?" : "Ange nytt lösenord?"}
            </h3>
            {isSelf ? (
              <p className="mt-2 text-sm text-neutral-600">
                Du sätter ett nytt lösenord på ditt eget konto nu. Det är inte
                ett tillfälligt lösenord — du behöver inte byta det vid nästa
                inloggning. Kom ihåg det. Ingen e-post skickas.
              </p>
            ) : (
              <p className="mt-2 text-sm text-neutral-600">
                Detta ersätter det nuvarande lösenordet för{" "}
                <span className="font-medium text-neutral-900">{displayName}</span>
                {email ? ` (${email})` : null}. Användaren får ingen e-post.
                E-postadressen markeras som bekräftad, så användaren kan logga in
                direkt.
              </p>
            )}

            {isSelf ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor={`own-password-${userId}`}
                    className="block text-xs font-medium text-neutral-500"
                  >
                    Nytt lösenord
                  </label>
                  <input
                    id={`own-password-${userId}`}
                    type="password"
                    autoComplete="new-password"
                    value={ownPassword}
                    onChange={(event) => setOwnPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`own-password-confirm-${userId}`}
                    className="block text-xs font-medium text-neutral-500"
                  >
                    Bekräfta nytt lösenord
                  </label>
                  <input
                    id={`own-password-confirm-${userId}`}
                    type="password"
                    autoComplete="new-password"
                    value={ownPasswordConfirm}
                    onChange={(event) =>
                      setOwnPasswordConfirm(event.target.value)
                    }
                    className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
                  />
                </div>
              </div>
            ) : null}

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
                {isSelf
                  ? isPending
                    ? "Sparar…"
                    : "Spara lösenord"
                  : isPending
                    ? "Skapar…"
                    : "OK"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ownDone ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`own-password-done-title-${userId}`}
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
              id={`own-password-done-title-${userId}`}
              className="text-base font-semibold text-neutral-900"
            >
              Lösenordet är uppdaterat
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              Ditt nya lösenord gäller nu. Kom ihåg det — det visas inte igen.
              Du behöver inte byta det vid nästa inloggning.
            </p>
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
              inte. Användaren kan logga in med lösenordet direkt (e-post
              markerad som bekräftad).
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
