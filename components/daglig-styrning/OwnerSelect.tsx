import type { GoalOwnerOption } from "@/lib/goals/owner";
import { boardFieldClass } from "./boardStyles";

type OwnerSelectProps = {
  owners: GoalOwnerOption[];
  name?: string;
  defaultValue?: string;
  id?: string;
  className?: string;
};

export function OwnerSelect({
  owners,
  name = "ownerId",
  defaultValue = "",
  id,
  className = boardFieldClass,
}: OwnerSelectProps) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className={`${className} w-full`}
    >
      <option value="">Välj ansvarig</option>
      {owners.map((owner) => (
        <option key={owner.id} value={owner.id}>
          {owner.displayName}
        </option>
      ))}
    </select>
  );
}
