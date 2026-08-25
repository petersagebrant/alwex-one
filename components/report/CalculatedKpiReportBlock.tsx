import { BeraknadTypeBadge } from "@/components/kpis/BeraknadTypeBadge";
import { StatusBadge } from "@/components/ui";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { formatDateSv } from "@/lib/format/date";
import { isStatusTone } from "@/lib/kpi/kind";
import type { DailyKpiReportItem } from "@/types";

type CalculatedKpiReportBlockProps = {
  item: DailyKpiReportItem;
  reportDate: string;
};

/**
 * Read-only block for system-computed KPIs on the daily reporting page.
 * CALCULATED (DIVIDE): no G/Y/R. TARGET ratio (Sjukfrånvaro): shows status when complete.
 */
export function CalculatedKpiReportBlock({
  item,
  reportDate,
}: CalculatedKpiReportBlockProps) {
  const unit = item.kpi.unit;
  const isRatioTarget =
    item.kpi.kind === "TARGET" && item.kpi.calcOperator != null;
  const isComplete = item.computation?.isComplete ?? item.isReported;
  const todayValue = isComplete ? (item.todayReport?.value ?? null) : null;
  const status =
    isRatioTarget && isComplete && item.todayReport
      ? item.todayReport.status
      : isRatioTarget && isComplete && isStatusTone(item.kpi.status)
        ? item.kpi.status
        : null;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">
              {item.kpi.name}
            </h3>
            {status && isStatusTone(status) ? (
              <StatusBadge status={status} />
            ) : (
              <BeraknadTypeBadge />
            )}
          </div>
          {isRatioTarget && item.kpi.targetValue ? (
            <p className="text-sm text-slate-600">
              Mål: {formatKpiDisplayValue(item.kpi.targetValue, unit)}
            </p>
          ) : null}
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <div>
              <dt className="inline text-slate-500">
                {formatDateSv(reportDate)}:{" "}
              </dt>
              <dd className="inline font-medium text-slate-800">
                {isComplete
                  ? formatKpiDisplayValue(todayValue, unit)
                  : "Ej rapporterat"}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">Föregående: </dt>
              <dd className="inline font-medium text-slate-800">
                {formatKpiDisplayValue(item.previousValue, unit)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">Beräknas automatiskt</p>
          {item.computation?.completenessLabel ? (
            <p className="text-xs text-slate-500">
              {item.computation.completenessLabel}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
