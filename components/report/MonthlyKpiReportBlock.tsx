"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  loadMonthlyKpiValueAction,
  reportMonthlyKpiAction,
} from "@/app/report/kpis/actions";
import { StatusBadge } from "@/components/ui";
import { computeKpiStatus } from "@/lib/kpi/computeStatus";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { isStatusTone } from "@/lib/kpi/kind";
import { computeEconomicDeviation } from "@/lib/kpi/economics";
import { buildMonthlyResultPresentation } from "@/lib/kpi/monthlyResultPresentation";
import type { DailyKpiReportItem } from "@/types";

export function MonthlyKpiReportBlock({
  item,
  onReported,
}: {
  item: DailyKpiReportItem;
  onReported?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState((item.periodMonth ?? "").slice(0, 7));
  const [actualValue, setActualValue] = useState(item.actualValue ?? "");
  const [budgetValue, setBudgetValue] = useState(item.budgetValue ?? "");
  const [comment, setComment] = useState(item.todayReport?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const deviationValue = computeEconomicDeviation(actualValue, budgetValue);
  const presentation = buildMonthlyResultPresentation({
    kpiName: item.kpi.name,
    unit: item.kpi.unit,
    periodLabel: item.periodLabel ?? "",
    isReported: item.isReported,
    pendingLabel: item.pendingLabel,
    expectedFinalizationLabel: item.expectedFinalizationLabel,
    actualValue: item.actualValue,
    budgetValue: item.budgetValue,
    status: item.todayReport?.status,
  });
  const status = deviationValue === null ? null : computeKpiStatus({
    direction: item.kpi.direction,
    toleranceType: item.kpi.toleranceType,
    greenTolerance: item.kpi.greenTolerance,
    yellowTolerance: item.kpi.yellowTolerance,
    value: deviationValue,
    target: item.kpi.targetValue,
  });
  const commentRequired = status === "Gul" || status === "Röd";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    if (!period || !actualValue.trim() || !budgetValue.trim()) {
      setError("Välj resultatmånad och ange både faktiskt och budgeterat resultat.");
      return;
    }
    if (!status || !isStatusTone(status)) {
      setError("Ange ett giltigt värde.");
      return;
    }
    if (commentRequired && !comment.trim()) {
      setError("Beskriv kort varför resultatet avviker.");
      return;
    }
    startTransition(async () => {
      const result = await reportMonthlyKpiAction({
        kpiId: item.kpi.id,
        periodMonth: `${period}-01`,
        actualValue,
        budgetValue,
        comment,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(
        `Sparat för ${period}: avvikelse ${formatKpiDisplayValue(deviationValue, item.kpi.unit)}`,
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
      setActualValue(result.actualValue ?? "");
      setBudgetValue(result.budgetValue ?? "");
      setComment(result.comment ?? "");
      if (result.isLegacyDeviation) {
        setSaved(`Äldre avvikelse ${result.deviationValue ?? "—"}; resultat och budget saknas.`);
      }
    });
  }

  if (!editing) {
    return (
      <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">
              {presentation.title}
            </h3>
            {item.isReported ? (
              <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-5 sm:gap-4">
                <div>
                  <dt className="text-xs text-slate-500">Resultatmånad</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {presentation.resultMonth}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Faktiskt resultat</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {presentation.actualValue}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Budgeterat resultat</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {presentation.budgetValue}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Avvikelse</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {presentation.deviationValue}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {presentation.statusValue}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="mt-2 text-sm text-slate-600">
                <p className="font-medium">{presentation.pendingLabel}</p>
                {presentation.expectedFinalizationLabel ? (
                  <p className="text-xs text-slate-500">
                    {presentation.expectedFinalizationLabel}
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {item.isReported ? (
              item.todayReport && isStatusTone(item.todayReport.status) ? (
                <StatusBadge status={item.todayReport.status} />
              ) : null
            ) : (
              <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {presentation.pendingLabel}
              </span>
            )}
            {item.isReported ? (
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                Rapporterad
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 rounded-xl bg-[#0b1220] px-3.5 py-2 text-sm font-semibold text-white"
        >
          {item.isReported ? "Redigera månadsresultat" : "Rapportera månadsresultat"}
        </button>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {presentation.title}
          </h3>
          {!item.isReported ? (
            <div className="mt-2 text-sm text-slate-600">
              <p className="font-medium">{presentation.pendingLabel}</p>
              <p className="text-xs text-slate-500">
                {presentation.expectedFinalizationLabel}
              </p>
            </div>
          ) : null}
        </div>
        {item.isReported ? (
          item.todayReport && isStatusTone(item.todayReport.status) ? (
            <StatusBadge status={item.todayReport.status} />
          ) : null
        ) : (
          <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            {presentation.pendingLabel}
          </span>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-slate-500">
          Resultatmånad
          <input
            type="month"
            value={period}
            onChange={(event) => changePeriod(event.target.value)}
            disabled={isPending}
            required
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Faktiskt resultat ({item.kpi.unit})
          <input
            type="text"
            value={actualValue}
            onChange={(event) => setActualValue(event.target.value)}
            disabled={isPending}
            required
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Budgeterat resultat ({item.kpi.unit})
          <input
            type="text"
            value={budgetValue}
            onChange={(event) => setBudgetValue(event.target.value)}
            disabled={isPending}
            required
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-medium text-slate-500">Avvikelse ({item.kpi.unit})</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {deviationValue === null
              ? "Inväntar både resultat och budget"
              : formatKpiDisplayValue(deviationValue, item.kpi.unit)}
          </p>
        </div>
        {status ? (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            Status för vald resultatmånad: <StatusBadge status={status} />
          </div>
        ) : null}
        <label className="block text-xs font-medium text-slate-500">
          Kommentar{commentRequired ? " (obligatorisk)" : " (valfri)"}
          <textarea
            rows={2}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={isPending}
            required={commentRequired}
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
            {isPending ? "Sparar…" : item.isReported ? "Uppdatera månadsresultat" : "Rapportera månadsresultat"}
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
