import type { ReactNode } from "react";
import { StatusBadge } from "./StatusBadge";
import type { UiStatus, UiTrend } from "./types";

export type MetricCardProps = {
  name: string;
  currentValue: ReactNode;
  targetValue?: ReactNode;
  trend?: UiTrend;
  status?: UiStatus;
  className?: string;
};

export function MetricCard({
  name,
  currentValue,
  targetValue,
  trend,
  status,
  className = "",
}: MetricCardProps) {
  return (
    <article
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{name}</p>
        {status ? <StatusBadge status={status} /> : null}
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {currentValue}
      </p>

      <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
        {targetValue !== undefined ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt>Mål</dt>
            <dd className="font-medium text-slate-800">{targetValue}</dd>
          </div>
        ) : null}
        {trend ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt>Trend</dt>
            <dd className="font-medium text-slate-800">{trend}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
