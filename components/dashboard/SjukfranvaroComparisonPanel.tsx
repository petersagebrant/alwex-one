import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { formatSjukfranvaroVdCompletenessLabel } from "@/lib/kpi/sjukfranvaroCompletenessLabel";
import type { SjukfranvaroComparison } from "@/services/sjukfranvaro";
import { isStatusTone } from "@/lib/kpi/kind";

type SjukfranvaroComparisonPanelProps = {
  data: SjukfranvaroComparison;
};

function companyHeadline(data: SjukfranvaroComparison): string {
  // Prefer a short VD label; fall back if the company KPI is missing.
  return data.company ? "Sjukfrånvaro Alwex" : "Sjukfrånvaro";
}

/** VD comparison: company total + per-AO Sjukfrånvaro with status colors. */
export function SjukfranvaroComparisonPanel({
  data,
}: SjukfranvaroComparisonPanelProps) {
  if (!data.company && data.areas.length === 0) {
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
  const showValue = Boolean(company && company.reportedAreas > 0);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
      {company ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {companyHeadline(data)}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {showValue
                ? formatKpiDisplayValue(company.value, "%")
                : "Ej rapporterat"}
            </p>
            {showValue &&
            company.status &&
            isStatusTone(company.status) ? (
              <StatusBadge status={company.status} />
            ) : null}
          </div>
          {completeness ? (
            <p className="text-xs font-medium text-amber-700">{completeness}</p>
          ) : null}
        </div>
      ) : (
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">
          Sjukfrånvaro
        </h2>
      )}

      {data.areas.length > 0 ? (
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
          {data.areas.map((row) => (
            <li
              key={row.kpiId}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <Link
                href={`/admin/kpis/${row.kpiId}`}
                className="min-w-0 text-sm font-medium text-slate-800 hover:underline"
              >
                {row.areaName}
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-sm tabular-nums text-slate-700">
                  {row.isReported
                    ? formatKpiDisplayValue(row.value, "%")
                    : "Ej rapporterat"}
                </span>
                {row.isReported && row.status && isStatusTone(row.status) ? (
                  <StatusBadge status={row.status} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
