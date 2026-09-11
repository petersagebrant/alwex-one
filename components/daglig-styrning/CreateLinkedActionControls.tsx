"use client";

import { useState, type ReactNode } from "react";
import { createSteeringActivityAction } from "@/app/daglig-styrning/actions";
import type { GoalOwnerOption } from "@/lib/goals/owner";
import { OwnerSelect } from "./OwnerSelect";
import {
  boardActionClusterClass,
  boardCancelButtonClass,
  boardEscalateButtonClass,
  boardFieldClass,
  boardPrimaryButtonClass,
} from "./boardStyles";

type CreateLinkedActionControlsProps = {
  sourceType: "report" | "kpi";
  sourceId: string;
  businessAreaId: string;
  defaultDeadline: string;
  owners: GoalOwnerOption[];
  leading?: ReactNode;
  extraOverflow?: ReactNode;
};

export function CreateLinkedActionControls({
  sourceType,
  sourceId,
  businessAreaId,
  defaultDeadline,
  owners,
  leading,
  extraOverflow,
}: CreateLinkedActionControlsProps) {
  const [mode, setMode] = useState<"idle" | "create" | "escalate">("idle");

  if (mode === "create") {
    return (
      <form
        action={async (formData) => {
          await createSteeringActivityAction(formData);
          setMode("idle");
        }}
        className="w-full max-w-sm space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5"
      >
        <input type="hidden" name="sourceType" value={sourceType} />
        <input type="hidden" name="sourceId" value={sourceId} />
        <input type="hidden" name="businessAreaId" value={businessAreaId} />
        <label className="block">
          <span className="block text-[11px] font-medium text-slate-500">
            Åtgärd
          </span>
          <input
            name="title"
            type="text"
            required
            placeholder="Vad ska göras?"
            className={`${boardFieldClass} mt-1 w-full`}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium text-slate-500">
            Ansvarig
          </span>
          <span className="mt-1 block">
            <OwnerSelect owners={owners} />
          </span>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium text-slate-500">
            Klart senast
          </span>
          <input
            name="deadline"
            type="date"
            defaultValue={defaultDeadline}
            className={`${boardFieldClass} mt-1 w-full`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="submit" className={boardPrimaryButtonClass}>
            Spara
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className={boardCancelButtonClass}
          >
            Avbryt
          </button>
        </div>
      </form>
    );
  }

  if (mode === "escalate") {
    return (
      <form
        action={async (formData) => {
          await createSteeringActivityAction(formData);
          setMode("idle");
        }}
        className="w-full max-w-sm space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5"
      >
        <input type="hidden" name="sourceType" value={sourceType} />
        <input type="hidden" name="sourceId" value={sourceId} />
        <input type="hidden" name="businessAreaId" value={businessAreaId} />
        <input type="hidden" name="requiresEscalation" value="1" />
        <input type="hidden" name="deadline" value={defaultDeadline} />
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
            onClick={() => setMode("idle")}
            className={boardCancelButtonClass}
          >
            Avbryt
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={boardActionClusterClass}>
      {leading}
      <button
        type="button"
        onClick={() => setMode("create")}
        className={boardPrimaryButtonClass}
      >
        Åtgärd
      </button>
      {extraOverflow}
      <button
        type="button"
        onClick={() => setMode("escalate")}
        className={boardEscalateButtonClass}
      >
        Eskalera
      </button>
    </div>
  );
}
