"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { StatusBadge } from "@/components/ui";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { isStatusTone } from "@/lib/kpi/kind";
import { reportDailyKpiAction } from "@/app/report/kpis/actions";
import type { RatioPercentReportGroup } from "@/types";

type RatioPercentReportBlockProps = {
  group: RatioPercentReportGroup;
  /** Called after a successful save so parent clients can reload SoT. */
  onReported?: () => void;
};

/**
 * One visual block for a RATIO_PERCENT TARGET + its two STATISTIC inputs.
 * AO edits only the inputs; the % result is read-only and refreshes after save.
 * Default view is a compact card (like DailyKpiReportCard); expand only to report/edit.
 */
export function RatioPercentReportBlock({
  group,
  onReported,
}: RatioPercentReportBlockProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [numeratorValue, setNumeratorValue] = useState("");
  const [denominatorValue, setDenominatorValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { result, numerator, denominator } = group;
  const resultUnit = result.kpi.unit;
  const numUnit = numerator.kpi.unit;
  const denUnit = denominator.kpi.unit;

  const isComplete = result.computation?.isComplete ?? false;
  const todayResultValue = isComplete
    ? (result.todayReport?.value ?? null)
    : null;
  const status =
    isComplete && result.todayReport
      ? result.todayReport.status
      : isComplete && isStatusTone(result.kpi.status)
        ? result.kpi.status
        : null;
  // Same SoT as progress: both STATISTIC inputs reported today.
  const bothInputsReported = numerator.isReported && denominator.isReported;
  const statusTone = isStatusTone(status) ? status : null;

  useEffect(() => {
    setNumeratorValue(numerator.todayReport?.value ?? "");
    setDenominatorValue(denominator.todayReport?.value ?? "");
  }, [
    numerator.kpi.id,
    numerator.todayReport?.value,
    numerator.todayReport?.updatedAt,
    denominator.kpi.id,
    denominator.todayReport?.value,
    denominator.todayReport?.updatedAt,
  ]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedMessage(null);

    if (!numeratorValue.trim() || !denominatorValue.trim()) {
      setError("Ange båda underlagen.");
      return;
    }

    startTransition(async () => {
      const numResult = await reportDailyKpiAction({
        kpiId: numerator.kpi.id,
        value: numeratorValue,
        status: "Statistik",
      });
      if (!numResult.ok) {
        setError(numResult.error);
        return;
      }

      const denResult = await reportDailyKpiAction({
        kpiId: denominator.kpi.id,
        value: denominatorValue,
        status: "Statistik",
      });
      if (!denResult.ok) {
        setError(denResult.error);
        return;
      }

      setSavedMessage("Sparad — beräknad procent uppdateras automatiskt.");
      setEditing(false);
      onReported?.();
      router.refresh();
    });
  }

  function openEditor() {
    setError(null);
    setSavedMessage(null);
    setNumeratorValue(numerator.todayReport?.value ?? "");
    setDenominatorValue(denominator.todayReport?.value ?? "");
    setEditing(true);
  }

  function closeEditor() {
    setEditing(false);
    setError(null);
    setSavedMessage(null);
    setNumeratorValue(numerator.todayReport?.value ?? "");
    setDenominatorValue(denominator.todayReport?.value ?? "");
  }

  if (!editing) {
    return (
      <article className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        <div
          role={bothInputsReported ? "button" : undefined}
          tabIndex={bothInputsReported ? 0 : undefined}
          onClick={bothInputsReported ? openEditor : undefined}
          onKeyDown={
            bothInputsReported
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openEditor();
                  }
                }
              : undefined
          }
          className={`flex w-full flex-wrap items-start justify-between gap-3 rounded-2xl p-4 text-left sm:p-5 ${
            bothInputsReported
              ? "cursor-pointer transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              : ""
          }`}
        >
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">
              {result.kpi.name}
            </h3>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {bothInputsReported ? (
                <div>
                  <dt className="inline text-slate-500">Idag: </dt>
                  <dd className="inline font-medium text-slate-800">
                    {formatKpiDisplayValue(todayResultValue, resultUnit)}
                  </dd>
                </div>
              ) : null}
              {result.kpi.targetValue ? (
                <div>
                  <dt className="inline text-slate-500">Mål: </dt>
                  <dd className="inline font-medium text-slate-800">
                    {formatKpiDisplayValue(result.kpi.targetValue, resultUnit)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="inline text-slate-500">Föregående: </dt>
                <dd className="inline font-medium text-slate-800">
                  {formatKpiDisplayValue(result.previousValue, resultUnit)}
                </dd>
              </div>
            </dl>
            {!bothInputsReported ? (
              <button
                type="button"
                onClick={openEditor}
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#0b1220] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Rapportera
              </button>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {bothInputsReported && statusTone ? (
              <StatusBadge status={statusTone} />
            ) : null}
            <span
              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                bothInputsReported
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
                  : "bg-slate-50 text-slate-700 ring-slate-200/80"
              }`}
            >
              {bothInputsReported ? "Rapporterad" : "Ej rapporterad"}
            </span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-slate-900">
            {result.kpi.name}
          </h3>
          <p className="text-xs text-slate-500">
            Ange underlag — procent beräknas automatiskt.
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
            bothInputsReported
              ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
              : "bg-slate-50 text-slate-700 ring-slate-200/80"
          }`}
        >
          {bothInputsReported ? "Rapporterad" : "Ej rapporterad"}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-3">
          <div>
            <label
              htmlFor={`ratio-num-${numerator.kpi.id}`}
              className="block text-sm font-medium text-slate-800"
            >
              {numerator.kpi.name}
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id={`ratio-num-${numerator.kpi.id}`}
                name="numerator"
                type="text"
                required
                value={numeratorValue}
                onChange={(event) => {
                  setNumeratorValue(event.target.value);
                  setSavedMessage(null);
                }}
                disabled={isPending}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Ange värde"
                autoComplete="off"
              />
              {numUnit?.trim() ? (
                <span className="shrink-0 text-sm text-slate-500">
                  {numUnit.trim()}
                </span>
              ) : null}
            </div>
          </div>

          <div>
            <label
              htmlFor={`ratio-den-${denominator.kpi.id}`}
              className="block text-sm font-medium text-slate-800"
            >
              {denominator.kpi.name}
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id={`ratio-den-${denominator.kpi.id}`}
                name="denominator"
                type="text"
                required
                value={denominatorValue}
                onChange={(event) => {
                  setDenominatorValue(event.target.value);
                  setSavedMessage(null);
                }}
                disabled={isPending}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Ange värde"
                autoComplete="off"
              />
              {denUnit?.trim() ? (
                <span className="shrink-0 text-sm text-slate-500">
                  {denUnit.trim()}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Beräknad {result.kpi.name.toLowerCase()}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {isComplete
              ? formatKpiDisplayValue(todayResultValue, resultUnit)
              : "—"}
          </p>
          <dl className="mt-2 space-y-1 text-sm text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-slate-500">Status:</dt>
              <dd>
                {statusTone ? (
                  <StatusBadge status={statusTone} />
                ) : (
                  <span className="font-medium text-slate-800">—</span>
                )}
              </dd>
            </div>
            {result.kpi.targetValue ? (
              <div>
                <dt className="inline text-slate-500">Mål: </dt>
                <dd className="inline font-medium text-slate-800">
                  {formatKpiDisplayValue(result.kpi.targetValue, resultUnit)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="inline text-slate-500">Föregående: </dt>
              <dd className="inline font-medium text-slate-800">
                {formatKpiDisplayValue(result.previousValue, resultUnit)}
              </dd>
            </div>
          </dl>
        </div>

        {error ? (
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        {savedMessage ? (
          <p
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            role="status"
          >
            {savedMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-xl bg-[#0b1220] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Sparar…"
              : bothInputsReported
                ? "Uppdatera rapport"
                : "Rapportera"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={closeEditor}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Avbryt
          </button>
        </div>
      </form>
    </article>
  );
}
