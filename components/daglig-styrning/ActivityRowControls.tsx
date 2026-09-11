"use client";

import { useState } from "react";
import { patchSteeringActivityAction } from "@/app/daglig-styrning/actions";
import { nextSteeringBoardStatus } from "@/lib/operational-reports/boardPresentation";
import { hasAnsweredEscalation } from "@/lib/operational-reports/escalation";
import type { ActivityStatus } from "@/types/activity";
import type { ActivityEscalation } from "@/types/activity-escalation";
import {
  boardActionClusterClass,
  boardCancelButtonClass,
  boardEscalateButtonClass,
  boardFieldClass,
  boardNextStatusButtonClass,
} from "./boardStyles";

type ActivityRowControlsProps = {
  activityId: string;
  status: ActivityStatus;
  requiresEscalation: boolean;
  escalations: ActivityEscalation[];
  canUpdate: boolean;
  canComplete: boolean;
};

export function ActivityRowControls({
  activityId,
  status,
  requiresEscalation,
  escalations,
  canUpdate,
  canComplete,
}: ActivityRowControlsProps) {
  const [escalateOpen, setEscalateOpen] = useState(false);
  const nextStatus = nextSteeringBoardStatus(status);
  const showEscalate =
    !requiresEscalation && !hasAnsweredEscalation(escalations);
  const showKlar = Boolean(nextStatus) && canComplete;

  if (!canUpdate) {
    return null;
  }

  if (!showKlar && !showEscalate && !escalateOpen) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className={boardActionClusterClass}>
        {showKlar && nextStatus ? (
          <form action={patchSteeringActivityAction} className="inline-flex">
            <input type="hidden" name="id" value={activityId} />
            <input type="hidden" name="intent" value="status" />
            <input type="hidden" name="status" value={nextStatus.value} />
            <button
              type="submit"
              className={boardNextStatusButtonClass(nextStatus.value)}
            >
              {nextStatus.label}
            </button>
          </form>
        ) : null}
        {showEscalate && !escalateOpen ? (
          <button
            type="button"
            onClick={() => setEscalateOpen(true)}
            className={boardEscalateButtonClass}
          >
            Eskalera
          </button>
        ) : null}
      </div>
      {escalateOpen && showEscalate ? (
        <form
          action={async (formData) => {
            await patchSteeringActivityAction(formData);
            setEscalateOpen(false);
          }}
          className="w-full max-w-sm space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5"
        >
          <input type="hidden" name="id" value={activityId} />
          <input type="hidden" name="intent" value="escalation" />
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-600">
              Vad behöver du hjälp/beslut med?
            </span>
            <textarea
              name="escalationNote"
              required
              rows={2}
              className={`${boardFieldClass} mt-1 w-full`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="submit" className={boardEscalateButtonClass}>
              Eskalera
            </button>
            <button
              type="button"
              onClick={() => setEscalateOpen(false)}
              className={boardCancelButtonClass}
            >
              Avbryt
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
