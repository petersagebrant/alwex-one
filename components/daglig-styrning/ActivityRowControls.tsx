"use client";

import { useState } from "react";
import { patchSteeringActivityAction } from "@/app/daglig-styrning/actions";
import {
  isSteeringBoardStatusSelected,
  STEERING_BOARD_STATUS_ACTIONS,
  steeringBoardStatusLabel,
} from "@/lib/operational-reports/boardPresentation";
import type { ActivityStatus } from "@/types/activity";
import {
  boardCancelButtonClass,
  boardEscalateButtonClass,
  boardFieldClass,
  boardGhostButtonClass,
} from "./boardStyles";

type ActivityRowControlsProps = {
  activityId: string;
  status: ActivityStatus;
  requiresEscalation: boolean;
  canUpdate: boolean;
};

export function ActivityRowControls({
  activityId,
  status,
  requiresEscalation,
  canUpdate,
}: ActivityRowControlsProps) {
  const [escalateOpen, setEscalateOpen] = useState(false);

  if (!canUpdate) {
    return (
      <p className="text-xs font-medium text-slate-500">
        {steeringBoardStatusLabel(status)}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="inline-flex flex-wrap justify-end gap-1">
        {STEERING_BOARD_STATUS_ACTIONS.map((item) => {
          const selected = isSteeringBoardStatusSelected(status, item.value);
          return (
            <form key={item.value} action={patchSteeringActivityAction}>
              <input type="hidden" name="id" value={activityId} />
              <input type="hidden" name="intent" value="status" />
              <input type="hidden" name="status" value={item.value} />
              <button
                type="submit"
                disabled={selected}
                className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                  selected
                    ? "bg-[#0b1220] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                } disabled:cursor-default`}
              >
                {item.label}
              </button>
            </form>
          );
        })}
        {!requiresEscalation && !escalateOpen ? (
          <button
            type="button"
            onClick={() => setEscalateOpen(true)}
            className={boardEscalateButtonClass}
          >
            Eskalera
          </button>
        ) : null}
        {requiresEscalation ? (
          <form action={patchSteeringActivityAction}>
            <input type="hidden" name="id" value={activityId} />
            <input type="hidden" name="intent" value="end-escalation" />
            <button type="submit" className={boardGhostButtonClass}>
              Besvarad
            </button>
          </form>
        ) : null}
      </div>
      {escalateOpen && !requiresEscalation ? (
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
