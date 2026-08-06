"use client";

import { useMemo, useState } from "react";

type AreaOption = { id: string; name: string };
type GoalOption = { id: string; title: string; businessAreaId: string };

type ActivityFormFieldsProps = {
  areas: AreaOption[];
  goals: GoalOption[];
  initialBusinessAreaId?: string;
  initialGoalId?: string | null;
};

const fieldClassName =
  "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20";

export function ActivityFormFields({
  areas,
  goals,
  initialBusinessAreaId = "",
  initialGoalId = "",
}: ActivityFormFieldsProps) {
  const [businessAreaId, setBusinessAreaId] = useState(initialBusinessAreaId);

  const filteredGoals = useMemo(
    () => goals.filter((goal) => goal.businessAreaId === businessAreaId),
    [goals, businessAreaId],
  );

  return (
    <>
      <div>
        <label
          htmlFor="businessAreaId"
          className="block text-xs font-medium text-neutral-500"
        >
          Affärsområde
        </label>
        <select
          id="businessAreaId"
          name="businessAreaId"
          required
          value={businessAreaId}
          onChange={(event) => setBusinessAreaId(event.target.value)}
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
      </div>

      <div>
        <label
          htmlFor="goalId"
          className="block text-xs font-medium text-neutral-500"
        >
          Kopplat mål
        </label>
        <select
          id="goalId"
          name="goalId"
          defaultValue={initialGoalId ?? ""}
          disabled={!businessAreaId}
          className={fieldClassName}
        >
          <option value="">Inget mål</option>
          {filteredGoals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
