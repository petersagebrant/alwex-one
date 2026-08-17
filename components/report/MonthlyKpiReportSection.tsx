import { DailyKpiReportList } from "@/components/report/DailyKpiReportList";
import type { DailyKpiReportItem } from "@/types";

type MonthlyKpiReportSectionProps = {
  items: DailyKpiReportItem[];
  onReported?: () => void;
};

/** MONTHLY manual KPIs — separate from daily progress (e.g. Resultat mot budget). */
export function MonthlyKpiReportSection({
  items,
  onReported,
}: MonthlyKpiReportSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-slate-800">
        Månadsvisa KPI:er
      </h2>
      <p className="text-xs text-slate-500">
        Räknas inte in i dagens rapporteringsprogress. Status gäller
        innevarande månad.
      </p>
      <DailyKpiReportList items={items} onReported={onReported} />
    </section>
  );
}
