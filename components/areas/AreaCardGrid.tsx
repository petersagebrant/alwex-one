import type { BusinessAreaSummary } from "@/types";
import { AreaCard } from "./AreaCard";

type AreaCardGridProps = {
  areas: BusinessAreaSummary[];
};

export function AreaCardGrid({ areas }: AreaCardGridProps) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {areas.map((area) => (
        <li key={area.slug}>
          <AreaCard area={area} />
        </li>
      ))}
    </ul>
  );
}
