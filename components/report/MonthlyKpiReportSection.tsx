import { MonthlyKpiReportBlock } from "@/components/report/MonthlyKpiReportBlock";
import { MonthlyStatisticReportBlock } from "@/components/report/MonthlyStatisticReportBlock";
import {
  isMonthlyEconomicKpi,
  isMonthlyEconomicResultKpi,
} from "@/lib/kpi/economics";
import { isMonthlyStatisticKpi } from "@/lib/kpi/kind";
import type { DailyKpiReportItem } from "@/types";

type MonthlyKpiReportSectionProps = {
  items: DailyKpiReportItem[];
  onReported?: () => void;
};

function economicSortKey(item: DailyKpiReportItem): number {
  if (isMonthlyEconomicResultKpi(item.kpi)) return 0;
  if (isMonthlyEconomicKpi(item.kpi)) return 1;
  return 2;
}

function MonthlyReportItem({
  item,
  onReported,
}: {
  item: DailyKpiReportItem;
  onReported?: () => void;
}) {
  if (isMonthlyStatisticKpi(item.kpi)) {
    return (
      <MonthlyStatisticReportBlock
        key={`${item.kpi.id}-${item.periodMonth}-${item.todayReport?.updatedAt ?? "pending"}`}
        item={item}
        onReported={onReported}
      />
    );
  }
  return (
    <MonthlyKpiReportBlock
      key={`${item.kpi.id}-${item.periodMonth}-${item.todayReport?.updatedAt ?? "pending"}`}
      item={item}
      onReported={onReported}
    />
  );
}

/** MONTHLY manual KPIs — separate from daily progress. */
export function MonthlyKpiReportSection({
  items,
  onReported,
}: MonthlyKpiReportSectionProps) {
  if (items.length === 0) {
    return null;
  }

  const economic = items
    .filter((item) => isMonthlyEconomicKpi(item.kpi))
    .sort((a, b) => economicSortKey(a) - economicSortKey(b));
  const rest = items.filter((item) => !isMonthlyEconomicKpi(item.kpi));

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
        {economic.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ekonomi
            </h3>
            {economic.map((item) => (
              <MonthlyReportItem
                key={`${item.kpi.id}-${item.periodMonth}-${item.todayReport?.updatedAt ?? "pending"}`}
                item={item}
                onReported={onReported}
              />
            ))}
          </div>
        ) : null}
        {rest.map((item) => (
          <MonthlyReportItem
            key={`${item.kpi.id}-${item.periodMonth}-${item.todayReport?.updatedAt ?? "pending"}`}
            item={item}
            onReported={onReported}
          />
        ))}
      </div>
    </section>
  );
}
