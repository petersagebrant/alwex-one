"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  loadMonthlyKpiValueAction,
  reportMonthlyStatisticKpiAction,
} from "@/app/report/kpis/actions";
import { StatistikTypeBadge } from "@/components/kpis/StatistikTypeBadge";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { monthlyStatisticPeriodLabel } from "@/lib/kpi/monthlyReporting";
import type { DailyKpiReportItem } from "@/types";

export function MonthlyStatisticReportBlock({
  item,
  onReported,
}: {
  item: DailyKpiReportItem;
  onReported?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState((item.periodMonth ?? "").slice(0, 7));
  const [value, setValue] = useState(item.todayReport?.value ?? "");
  const [comment, setComment] = useState(item.todayReport?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const periodLabel = /^\d{4}-\d{2}$/.test(period)
    ? monthlyStatisticPeriodLabel(`${period}-01`)
    : (item.periodLabel ?? "");
  const title = `${item.kpi.name} – ${periodLabel}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    if (!period || !value.trim()) {
      setError("Välj månad och ange ett värde.");
      return;
    }
    startTransition(async () => {
      const result = await reportMonthlyStatisticKpiAction({
        kpiId: item.kpi.id,
        periodMonth: `${period}-01`,
        value,
        comment,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(
        `Sparat för ${periodLabel}: ${formatKpiDisplayValue(value, item.kpi.unit)}`,
      );
      setEditing(false);
      onReported?.();
      router.refresh();
    });
  }

  function changePeriod(nextPeriod: string) {
    setPeriod(nextPeriod);
    setError(null);
    setSaved(null);
    if (!/^\d{4}-\d{2}$/.test(nextPeriod)) return;
    startTransition(async () => {
      const result = await loadMonthlyKpiValueAction({
        kpiId: item.kpi.id,
        periodMonth: `${nextPeriod}-01`,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setValue(result.value ?? "");
      setComment(result.comment ?? "");
    });
  }

  if (!editing) {
    return (
      <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <StatistikTypeBadge />
            </div>
            {item.isReported ? (
              <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 sm:gap-4">
                <div>
                  <dt className="text-xs text-slate-500">Period</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {periodLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Värde</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {formatKpiDisplayValue(item.todayReport?.value, item.kpi.unit)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                Rapportera värdet för {periodLabel}. Avser föregående
                kalendermånad.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${
                item.isReported
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
                  : "bg-slate-50 text-slate-600 ring-slate-200"
              }`}
            >
              {item.isReported ? "Rapporterad" : "Ej rapporterad"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 rounded-xl bg-[#0b1220] px-3.5 py-2 text-sm font-semibold text-white"
        >
          {item.isReported ? "Redigera månadsvärde" : "Rapportera månadsvärde"}
        </button>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <StatistikTypeBadge />
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${
            item.isReported
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
              : "bg-slate-50 text-slate-600 ring-slate-200"
          }`}
        >
          {item.isReported ? "Rapporterad" : "Ej rapporterad"}
        </span>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-slate-500">
          Period
          <input
            type="month"
            value={period}
            onChange={(event) => changePeriod(event.target.value)}
            disabled={isPending}
            required
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            {periodLabel}
          </span>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Värde{item.kpi.unit?.trim() ? ` (${item.kpi.unit.trim()})` : ""}
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={isPending}
            required
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Kommentar (valfri)
          <textarea
            rows={2}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={isPending}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-800">{saved}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-[#0b1220] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isPending
              ? "Sparar…"
              : item.isReported
                ? "Uppdatera månadsvärde"
                : "Rapportera månadsvärde"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setEditing(false);
              setError(null);
              setSaved(null);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            Avbryt
          </button>
        </div>
      </form>
    </article>
  );
}
