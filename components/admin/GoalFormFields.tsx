import type { GoalOwnerOption } from "@/lib/goals/owner";
import type { GoalListItem } from "@/services/goals";

type AreaOption = { id: string; name: string };

type GoalFormFieldsProps = {
  areas: AreaOption[];
  owners: GoalOwnerOption[];
  goal?: GoalListItem | null;
  lockedAreaId?: string | null;
};

export function GoalFormFields({
  areas,
  owners,
  goal,
  lockedAreaId,
}: GoalFormFieldsProps) {
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

  return (
    <>
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
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
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
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
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
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
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
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>
        <div>
          <label
            htmlFor="progress"
            className="block text-xs font-medium text-neutral-500"
          >
            Progress (%)
          </label>
          <input
            id="progress"
            name="progress"
            type="number"
            min={0}
            max={100}
            defaultValue={goal?.progress ?? ""}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>
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
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
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
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>
      </div>

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
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        >
          <option value="Grön">Grön</option>
          <option value="Gul">Gul</option>
          <option value="Röd">Röd</option>
        </select>
      </div>
    </>
  );
}
