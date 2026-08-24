import { MonthlyKpiReportBlock } from "@/components/report/MonthlyKpiReportBlock";
import { MonthlyStatisticReportBlock } from "@/components/report/MonthlyStatisticReportBlock";
import { isMonthlyStatisticKpi } from "@/lib/kpi/kind";
import type { DailyKpiReportItem } from "@/types";

type MonthlyKpiReportSectionProps = {
  items: DailyKpiReportItem[];
  onReported?: () => void;
};

/** MONTHLY manual KPIs — separate from daily progress. */
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
        Räknas inte in i dagens rapporteringsprogress. Värde och historik
        kopplas till vald månad, oberoende av rapporteringsdatum.
      </p>
      <div className="space-y-3">
        {items.map((item) =>
          isMonthlyStatisticKpi(item.kpi) ? (
            <MonthlyStatisticReportBlock
              key={`${item.kpi.id}-${item.periodMonth}-${item.todayReport?.updatedAt ?? "pending"}`}
              item={item}
              onReported={onReported}
            />
          ) : (
            <MonthlyKpiReportBlock
              key={`${item.kpi.id}-${item.periodMonth}-${item.todayReport?.updatedAt ?? "pending"}`}
              item={item}
              onReported={onReported}
            />
          ),
        )}
      </div>
    </section>
  );
}
