import { RatioPercentReportBlock } from "@/components/report/RatioPercentReportBlock";
import type { RatioPercentReportGroup } from "@/types";

type RatioPercentReportSectionProps = {
  groups: RatioPercentReportGroup[];
};

/** Grouped RATIO_PERCENT blocks (e.g. Sjukfrånvaro) above the normal KPI list. */
export function RatioPercentReportSection({
  groups,
}: RatioPercentReportSectionProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-3">
      {groups.map((group) => (
        <li key={group.result.kpi.id}>
          <RatioPercentReportBlock group={group} />
        </li>
      ))}
    </ul>
  );
}
