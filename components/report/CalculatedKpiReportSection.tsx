import { CalculatedKpiReportBlock } from "@/components/report/CalculatedKpiReportBlock";
import type { DailyKpiReportItem } from "@/types";

type CalculatedKpiReportSectionProps = {
  items: DailyKpiReportItem[];
};

/** Section under reportable KPIs — system-computed only, never in progress counts. */
export function CalculatedKpiReportSection({
  items,
}: CalculatedKpiReportSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-slate-800">
        Beräknade KPI:er
      </h2>
      <p className="text-xs text-slate-500">
        Värden beräknas automatiskt från rapporterade underlag.
      </p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.kpi.id}>
            <CalculatedKpiReportBlock item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
