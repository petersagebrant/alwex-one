"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveAreaNoticeAction,
  unarchiveAreaNoticeAction,
} from "@/app/admin/aktuellt/actions";

type AreaNoticeArchiveControlsProps = {
  noticeId: string;
  noticeTitle: string;
  businessAreaName: string;
  archived: boolean;
};

export function AreaNoticeArchiveControls({
  noticeId,
  noticeTitle,
  businessAreaName,
  archived,
}: AreaNoticeArchiveControlsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = archived
        ? await unarchiveAreaNoticeAction(noticeId)
        : await archiveAreaNoticeAction(noticeId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);
          setConfirmOpen(true);
        }}
        className="text-xs font-medium text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
      >
        {archived ? "Återaktivera" : "Arkivera"}
      </button>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`archive-notice-dialog-title-${noticeId}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!isPending) {
              setConfirmOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h3
              id={`archive-notice-dialog-title-${noticeId}`}
              className="text-base font-semibold text-neutral-900"
            >
              {archived ? "Återaktivera inlägg?" : "Arkivera inlägg?"}
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              {archived ? (
                <>
                  Inlägget{" "}
                  <span className="font-medium text-neutral-900">
                    {noticeTitle}
                  </span>{" "}
                  ({businessAreaName}) blir synligt igen på Aktuellt.
                </>
              ) : (
                <>
                  Inlägget{" "}
                  <span className="font-medium text-neutral-900">
                    {noticeTitle}
                  </span>{" "}
                  för affärsområdet{" "}
                  <span className="font-medium text-neutral-900">
                    {businessAreaName}
                  </span>{" "}
                  arkiveras. Det försvinner från Aktuellt, men historik
                  behålls.
                </>
              )}
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
                onClick={() => setConfirmOpen(false)}
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
                {isPending
                  ? "Sparar…"
                  : archived
                    ? "Ja, återaktivera"
                    : "Ja, arkivera"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
