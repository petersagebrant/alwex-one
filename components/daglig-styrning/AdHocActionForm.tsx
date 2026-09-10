"use client";

import { useState } from "react";
import { createAdHocSteeringActivityAction } from "@/app/daglig-styrning/actions";
import type { GoalOwnerOption } from "@/lib/goals/owner";
import { OwnerSelect } from "./OwnerSelect";
import {
  boardCancelButtonClass,
  boardFieldClass,
  boardGhostButtonClass,
  boardPrimaryButtonClass,
} from "./boardStyles";

type AdHocActionFormProps = {
  areas: { id: string; name: string }[];
  defaultDeadline: string;
  lockedAreaId?: string | null;
  owners: GoalOwnerOption[];
};

export function AdHocActionForm({
  areas,
  defaultDeadline,
  lockedAreaId,
  owners,
}: AdHocActionFormProps) {
  const [open, setOpen] = useState(false);
  const singleArea = lockedAreaId
    ? areas.find((area) => area.id === lockedAreaId)
    : areas.length === 1
      ? areas[0]
      : null;

  if (!open) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={boardGhostButtonClass}
        >
          + Lägg till åtgärd
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        await createAdHocSteeringActivityAction(formData);
        setOpen(false);
      }}
      className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3"
    >
      <div className="flex flex-wrap items-end gap-2">
        {singleArea ? (
          <input type="hidden" name="businessAreaId" value={singleArea.id} />
        ) : (
          <label className="min-w-40 flex-1">
            <span className="block text-[11px] font-medium text-slate-500">
              Affärsområde
            </span>
            <select
              name="businessAreaId"
              required
              defaultValue=""
              className={`${boardFieldClass} mt-1 w-full py-1.5 text-sm`}
            >
              <option value="" disabled>
                Välj AO
              </option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="min-w-48 flex-[2]">
          <span className="block text-[11px] font-medium text-slate-500">
            Åtgärd
          </span>
          <input
            name="title"
            type="text"
            required
            placeholder="Vad ska göras?"
            className={`${boardFieldClass} mt-1 w-full py-1.5 text-sm`}
          />
        </label>
        <label className="min-w-36 flex-1">
          <span className="block text-[11px] font-medium text-slate-500">
            Ansvarig
          </span>
          <span className="mt-1 block">
            <OwnerSelect
              owners={owners}
              className={`${boardFieldClass} py-1.5 text-sm`}
            />
          </span>
        </label>
        <label className="w-36">
          <span className="block text-[11px] font-medium text-slate-500">
            Klart senast
          </span>
          <input
            name="deadline"
            type="date"
            defaultValue={defaultDeadline}
            className={`${boardFieldClass} mt-1 w-full py-1.5 text-sm`}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="submit" className={boardPrimaryButtonClass}>
          Spara
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={boardCancelButtonClass}
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}
