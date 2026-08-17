import Link from "next/link";
import { SectionHeader, StatusBadge } from "@/components/ui";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { isStatusTone } from "@/lib/kpi/kind";
import { formatSjukfranvaroVdCompletenessLabel } from "@/lib/kpi/sjukfranvaroCompletenessLabel";
import type { SjukfranvaroComparison } from "@/services/sjukfranvaro";

type SjukfranvaroAreasSectionProps = {
  data: SjukfranvaroComparison;
};

/**
 * Affärsområden comparison for the company WEIGHTED_RATIO_PERCENT detail page.
 * Rows link to each AO's Sjukfrånvaro KPI detail (/kpis/[id]).
 */
export function SjukfranvaroAreasSection({
  data,
}: SjukfranvaroAreasSectionProps) {
  if (data.areas.length === 0) {
    return null;
  }

  const company = data.company;
  const completeness = company
    ? formatSjukfranvaroVdCompletenessLabel({
        reportedAreas: company.reportedAreas,
        totalAreas: company.totalAreas,
        isComplete: company.isComplete,
      })
    : null;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <SectionHeader
          title="Affärsområden"
          description="Sjukfrånvaro per affärsområde"
        />
        {completeness ? (
          <p className="mt-2 text-sm font-medium text-amber-700">
            {completeness}
          </p>
        ) : null}
      </div>

      <ul className="divide-y divide-slate-100 px-5">
        {data.areas.map((row) => (
          <li key={row.kpiId}>
            <Link
              href={`/kpis/${row.kpiId}`}
              className="flex flex-wrap items-center justify-between gap-2 py-3 transition hover:bg-slate-50/80"
            >
              <span className="min-w-0 text-sm font-medium text-slate-800">
                {row.areaName}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-sm tabular-nums text-slate-700">
                  {row.isReported
                    ? formatKpiDisplayValue(row.value, "%")
                    : "Ej rapporterat"}
                </span>
                {row.isReported && row.status && isStatusTone(row.status) ? (
                  <StatusBadge status={row.status} />
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
