import { DailyKpiReportCard } from "@/components/report/DailyKpiReportCard";
import type { DailyKpiReportItem } from "@/types";

type DailyKpiReportListProps = {
  items: DailyKpiReportItem[];
};

export function DailyKpiReportList({ items }: DailyKpiReportListProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200/80 bg-white p-5 text-sm text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        Inga KPI:er är skapade för detta affärsområde.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={`${item.kpi.id}-${item.todayReport?.updatedAt ?? "open"}`}>
          <DailyKpiReportCard item={item} />
        </li>
      ))}
    </ul>
  );
}
