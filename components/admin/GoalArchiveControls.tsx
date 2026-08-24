"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveGoalAction,
  unarchiveGoalAction,
} from "@/app/admin/goals/actions";

type GoalArchiveControlsProps = {
  goalId: string;
  goalTitle: string;
  businessAreaName: string;
  archived: boolean;
};

export function GoalArchiveControls({
  goalId,
  goalTitle,
  businessAreaName,
  archived,
}: GoalArchiveControlsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = archived
        ? await unarchiveGoalAction(goalId)
        : await archiveGoalAction(goalId);

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
          aria-labelledby={`archive-goal-dialog-title-${goalId}`}
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
              id={`archive-goal-dialog-title-${goalId}`}
              className="text-base font-semibold text-neutral-900"
            >
              {archived ? "Återaktivera mål?" : "Arkivera mål?"}
            </h3>
            <p className="mt-2 text-sm text-neutral-600">
              {archived ? (
                <>
                  Målet{" "}
                  <span className="font-medium text-neutral-900">
                    {goalTitle}
                  </span>{" "}
                  ({businessAreaName}) blir synligt igen bland aktiva mål,
                  dashboard och affärsområdet.
                </>
              ) : (
                <>
                  Målet{" "}
                  <span className="font-medium text-neutral-900">
                    {goalTitle}
                  </span>{" "}
                  för affärsområdet{" "}
                  <span className="font-medium text-neutral-900">
                    {businessAreaName}
                  </span>{" "}
                  arkiveras. Det försvinner från aktiva listor, men data och
                  historik behålls.
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
