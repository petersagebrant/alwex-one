"use client";

import { StatusBadge } from "@/components/ui";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { formatDateSv } from "@/lib/format/date";
import { committedRatioPercentPreview } from "@/lib/kpi/dailyKpiDisplay";
import type { RatioPercentReportGroup } from "@/types";

type RatioPercentReportFieldsProps = {
  group: RatioPercentReportGroup;
  reportDate: string;
  numeratorValue: string;
  denominatorValue: string;
  committedNumeratorValue: string;
  committedDenominatorValue: string;
  disabled?: boolean;
  onNumeratorChange: (value: string) => void;
  onDenominatorChange: (value: string) => void;
  onNumeratorBlur: (value: string) => void;
  onDenominatorBlur: (value: string) => void;
};

const VALUE_INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

/**
 * GROUPED RATIO_PERCENT inputs. The calculated TARGET % is read-only.
 */
export function RatioPercentReportFields({
  group,
  reportDate,
  numeratorValue,
  denominatorValue,
  committedNumeratorValue,
  committedDenominatorValue,
  disabled = false,
  onNumeratorChange,
  onDenominatorChange,
  onNumeratorBlur,
  onDenominatorBlur,
}: RatioPercentReportFieldsProps) {
  const { result, numerator, denominator } = group;
  const resultUnit = result.kpi.unit;
  const numUnit = numerator.kpi.unit?.trim() || "";
  const denUnit = denominator.kpi.unit?.trim() || "";

  const preview = committedRatioPercentPreview(
    result.kpi,
    committedNumeratorValue,
    committedDenominatorValue,
  );
  const bothInputsReported = numerator.isReported && denominator.isReported;
  const dateLabel = formatDateSv(reportDate);
  const savedTodayValue =
    (result.computation?.isComplete ?? false)
      ? (result.todayReport?.value ?? null)
      : null;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3
            className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:text-base"
            title={result.kpi.name}
          >
            {result.kpi.name}
          </h3>
          <p className="text-xs text-slate-500">
            Ange båda underlagen, eller lämna båda tomma. Procent beräknas
            automatiskt.
          </p>
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:text-sm">
            {result.kpi.targetValue ? (
              <div>
                <dt className="inline text-slate-500">Mål: </dt>
                <dd className="inline font-medium tabular-nums text-slate-800">
                  {formatKpiDisplayValue(result.kpi.targetValue, resultUnit)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="inline text-slate-500">Föregående: </dt>
              <dd className="inline font-medium tabular-nums text-slate-800">
                {formatKpiDisplayValue(result.previousValue, resultUnit)}
              </dd>
            </div>
            {bothInputsReported ? (
              <div>
                <dt className="inline text-slate-500">{dateLabel}: </dt>
                <dd className="inline font-medium tabular-nums text-slate-800">
                  {formatKpiDisplayValue(savedTodayValue, resultUnit)}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
            bothInputsReported
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
              : "bg-slate-50 text-slate-700 ring-slate-200/80"
          }`}
        >
          {bothInputsReported ? "Rapporterad" : "Ej rapporterad"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor={`ratio-num-${numerator.kpi.id}`}
            className="mb-0.5 block truncate text-xs font-medium text-slate-800 sm:text-sm"
            title={numerator.kpi.name}
          >
            {numerator.kpi.name}
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id={`ratio-num-${numerator.kpi.id}`}
              name={`value-${numerator.kpi.id}`}
              type="text"
              value={numeratorValue}
              onChange={(event) => onNumeratorChange(event.target.value)}
              onBlur={(event) => onNumeratorBlur(event.currentTarget.value)}
              disabled={disabled}
              className={VALUE_INPUT_CLASS}
              placeholder="Tomt = hoppa över"
              autoComplete="off"
            />
            {numUnit ? (
              <span className="shrink-0 text-xs font-medium text-slate-600">
                {numUnit}
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          <label
            htmlFor={`ratio-den-${denominator.kpi.id}`}
            className="mb-0.5 block truncate text-xs font-medium text-slate-800 sm:text-sm"
            title={denominator.kpi.name}
          >
            {denominator.kpi.name}
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id={`ratio-den-${denominator.kpi.id}`}
              name={`value-${denominator.kpi.id}`}
              type="text"
              value={denominatorValue}
              onChange={(event) => onDenominatorChange(event.target.value)}
              onBlur={(event) => onDenominatorBlur(event.currentTarget.value)}
              disabled={disabled}
              className={VALUE_INPUT_CLASS}
              placeholder="Tomt = hoppa över"
              autoComplete="off"
            />
            {denUnit ? (
              <span className="shrink-0 text-xs font-medium text-slate-600">
                {denUnit}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Beräknad {result.kpi.name}
          </p>
          <p className="text-base font-semibold tabular-nums text-slate-900">
            {preview.value != null
              ? formatKpiDisplayValue(preview.value, resultUnit)
              : "—"}
          </p>
        </div>
        {preview.status ? (
          <StatusBadge status={preview.status} />
        ) : (
          <span className="text-sm font-medium text-slate-500">—</span>
        )}
      </div>
    </article>
  );
}
