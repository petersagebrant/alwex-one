import { MonthlyKpiReportBlock } from "@/components/report/MonthlyKpiReportBlock";
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
        Räknas inte in i dagens rapporteringsprogress. Status och historik
        kopplas till vald resultatmånad, oberoende av rapporteringsdatum.
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <MonthlyKpiReportBlock
            key={`${item.kpi.id}-${item.periodMonth}-${item.todayReport?.updatedAt ?? "pending"}`}
            item={item}
            onReported={onReported}
          />
        ))}
      </div>
    </section>
  );
}
