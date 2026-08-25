import { RatioPercentReportBlock } from "@/components/report/RatioPercentReportBlock";
import type { RatioPercentReportGroup } from "@/types";

type RatioPercentReportSectionProps = {
  groups: RatioPercentReportGroup[];
  onReported?: () => void;
  reportDate: string;
};

/** Grouped RATIO_PERCENT blocks (e.g. Sjukfrånvaro) above the normal KPI list. */
export function RatioPercentReportSection({
  groups,
  onReported,
  reportDate,
}: RatioPercentReportSectionProps) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-3">
      {groups.map((group) => (
        <li
          key={`${group.result.kpi.id}-${group.numerator.todayReport?.updatedAt ?? "open"}-${group.denominator.todayReport?.updatedAt ?? "open"}`}
        >
          <RatioPercentReportBlock
            group={group}
            reportDate={reportDate}
            onReported={onReported}
          />
        </li>
      ))}
    </ul>
  );
}
