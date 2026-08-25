"use client";

import { useState } from "react";
import { GOAL_KIND_LABELS } from "@/lib/goals/kind";
import type { GoalKind } from "@/types";
import type { GoalOwnerOption } from "@/lib/goals/owner";
import type { GoalListItem } from "@/services/goals";

type AreaOption = { id: string; name: string };

type GoalFormFieldsProps = {
  areas: AreaOption[];
  owners: GoalOwnerOption[];
  goal?: GoalListItem | null;
  lockedAreaId?: string | null;
};

const fieldClassName =
  "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20";

export function GoalFormFields({
  areas,
  owners,
  goal,
  lockedAreaId,
}: GoalFormFieldsProps) {
  const [goalKind, setGoalKind] = useState<GoalKind>(
    goal?.goalKind ?? "MEASURABLE",
  );
  const selectedAreaId = lockedAreaId || goal?.businessAreaId || "";
  const ownerOptions = [...owners];
  if (
    goal?.ownerId &&
    !ownerOptions.some((owner) => owner.id === goal.ownerId)
  ) {
    ownerOptions.unshift({
      id: goal.ownerId,
      displayName: goal.owner?.trim() || "Tidigare ansvarig",
    });
  }

  const isMeasurable = goalKind === "MEASURABLE";

  return (
    <>
      <div>
        <label
          htmlFor="goalKind"
          className="block text-xs font-medium text-neutral-500"
        >
          Typ
        </label>
        <select
          id="goalKind"
          name="goalKind"
          value={goalKind}
          onChange={(event) => setGoalKind(event.target.value as GoalKind)}
          className={fieldClassName}
        >
          <option value="MEASURABLE">{GOAL_KIND_LABELS.MEASURABLE}</option>
          <option value="ACTIVITY">{GOAL_KIND_LABELS.ACTIVITY}</option>
        </select>
        <p className="mt-1.5 text-xs text-neutral-500">
          {isMeasurable
            ? "Progress och Grön/Gul/Röd beräknas automatiskt från aktuellt värde, målvärde och deadline."
            : "Följs genom kopplade aktiviteter. Grön/Gul/Röd sätts manuellt. Default är Gul."}
        </p>
      </div>

      <div>
        <label
          htmlFor="businessAreaId"
          className="block text-xs font-medium text-neutral-500"
        >
          Affärsområde
        </label>
        {lockedAreaId ? (
          <>
            <input
              type="hidden"
              id="businessAreaId"
              name="businessAreaId"
              value={lockedAreaId}
            />
            <p className="mt-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
              {areas.find((area) => area.id === lockedAreaId)?.name ??
                "Valt affärsområde"}
            </p>
          </>
        ) : (
          <select
            id="businessAreaId"
            name="businessAreaId"
            required
            defaultValue={selectedAreaId}
            className={fieldClassName}
          >
            <option value="" disabled>
              Välj affärsområde
            </option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label
          htmlFor="title"
          className="block text-xs font-medium text-neutral-500"
        >
          Namn
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={goal?.title ?? ""}
          className={fieldClassName}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-xs font-medium text-neutral-500"
        >
          Beskrivning
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={goal?.description ?? ""}
          className={fieldClassName}
        />
      </div>

      <div>
        <label
          htmlFor="ownerId"
          className="block text-xs font-medium text-neutral-500"
        >
          Ansvarig
        </label>
        <select
          id="ownerId"
          name="ownerId"
          defaultValue={goal?.ownerId ?? ""}
          className={fieldClassName}
        >
          <option value="">
            {goal?.owner && !goal.ownerId
              ? `${goal.owner} (ej kopplad användare)`
              : "Välj ansvarig"}
          </option>
          {ownerOptions.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.displayName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="lifecycle"
          className="block text-xs font-medium text-neutral-500"
        >
          Tillstånd
        </label>
        <select
          id="lifecycle"
          name="lifecycle"
          defaultValue={goal?.lifecycle ?? "ACTIVE"}
          className={fieldClassName}
        >
          <option value="ACTIVE">Aktivt</option>
          <option value="DONE">Klart</option>
        </select>
        <p className="mt-1.5 text-xs text-neutral-500">
          Klart är separat från Grön. Grön betyder i fas, inte avslutat.
        </p>
      </div>

      {isMeasurable ? (
        <>
          <div>
            <label
              htmlFor="deadline"
              className="block text-xs font-medium text-neutral-500"
            >
              Deadline
            </label>
            <input
              id="deadline"
              name="deadline"
              type="date"
              defaultValue={goal?.deadline ?? ""}
              className={fieldClassName}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="currentValue"
                className="block text-xs font-medium text-neutral-500"
              >
                Aktuellt värde
              </label>
              <input
                id="currentValue"
                name="currentValue"
                type="text"
                defaultValue={goal?.currentValue ?? ""}
                className={fieldClassName}
              />
            </div>
            <div>
              <label
                htmlFor="targetValue"
                className="block text-xs font-medium text-neutral-500"
              >
                Målvärde
              </label>
              <input
                id="targetValue"
                name="targetValue"
                type="text"
                defaultValue={goal?.targetValue ?? ""}
                className={fieldClassName}
              />
            </div>
          </div>
        </>
      ) : (
        <div>
          <label
            htmlFor="status"
            className="block text-xs font-medium text-neutral-500"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={goal?.status ?? "Gul"}
            className={fieldClassName}
          >
            <option value="Grön">Grön</option>
            <option value="Gul">Gul</option>
            <option value="Röd">Röd</option>
          </select>
        </div>
      )}
    </>
  );
}
