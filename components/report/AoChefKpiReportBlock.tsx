"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { StatistikTypeBadge } from "@/components/kpis/StatistikTypeBadge";
import { StatusBadge } from "@/components/ui";
import { computeKpiStatus } from "@/lib/kpi/computeStatus";
import { isStatisticKpi, isStatusTone } from "@/lib/kpi/kind";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { reportDailyKpiAction } from "@/app/report/kpis/actions";
import type { DailyKpiReportItem, StatusTone } from "@/types";

type AoChefKpiReportBlockProps = {
  item: DailyKpiReportItem;
  /** Optional — AO page is RSC-refreshed; VD client panels use this to reload SoT. */
  onReported?: () => void;
};

/**
 * Flat daily reporting block for AO-chef.
 * Definition fields (target/direction/tolerances) are display-only.
 */
export function AoChefKpiReportBlock({
  item,
  onReported,
}: AoChefKpiReportBlockProps) {
  const formVersion = JSON.stringify([
    item.kpi.id,
    item.kpi.status,
    item.todayReport?.value,
    item.todayReport?.status,
    item.todayReport?.comment,
    item.todayReport?.updatedAt,
    item.previousStatus,
  ]);

  return (
    <AoChefKpiReportForm
      key={formVersion}
      item={item}
      onReported={onReported}
    />
  );
}

function AoChefKpiReportForm({
  item,
  onReported,
}: AoChefKpiReportBlockProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(item.todayReport?.value ?? "");
  const [manualStatus, setManualStatus] = useState<StatusTone>(() => {
    const seed =
      item.todayReport?.status ?? item.previousStatus ?? item.kpi.status;
    return isStatusTone(seed) ? seed : "Gul";
  });
  const [comment, setComment] = useState(item.todayReport?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const isStatistic =
    isStatisticKpi(item.kpi) || item.kpi.status === "Statistik";
  const autoStatusEnabled = !isStatistic && Boolean(item.kpi.direction);
  const unit = item.kpi.unit;

  const lastValue = item.isReported
    ? item.todayReport?.value ?? item.previousValue
    : item.previousValue;
  const lastStatus = item.isReported
    ? item.todayReport?.status ?? item.previousStatus
    : item.previousStatus;
  const lastTone = isStatusTone(lastStatus) ? lastStatus : null;

  const liveComputedStatus = autoStatusEnabled
    ? computeKpiStatus({
        direction: item.kpi.direction,
        toleranceType: item.kpi.toleranceType,
        greenTolerance: item.kpi.greenTolerance,
        yellowTolerance: item.kpi.yellowTolerance,
        value,
        target: item.kpi.targetValue,
      })
    : null;

  const effectiveStatus: StatusTone =
    liveComputedStatus ?? manualStatus;
  const commentRequired =
    !isStatistic &&
    Boolean(value.trim()) &&
    (effectiveStatus === "Gul" || effectiveStatus === "Röd");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedMessage(null);

    if (!value.trim()) {
      setError("Ange dagens värde.");
      return;
    }
    if (commentRequired && !comment.trim()) {
      setError("Beskriv kort varför KPI:n avviker.");
      return;
    }

    startTransition(async () => {
      const result = await reportDailyKpiAction({
        kpiId: item.kpi.id,
        value,
        status: isStatistic ? "Statistik" : effectiveStatus,
        comment,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSavedMessage(
        isStatistic
          ? `Sparad: ${formatKpiDisplayValue(value, unit)}`
          : `Sparad: ${formatKpiDisplayValue(value, unit)} · ${effectiveStatus}`,
      );
      onReported?.();
      router.refresh();
    });
  }

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">
              {item.kpi.name}
            </h3>
            {isStatistic ? <StatistikTypeBadge /> : null}
          </div>
          {isStatistic ? (
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {item.isReported && item.todayReport ? (
                <div>
                  <dt className="inline text-slate-500">Idag: </dt>
                  <dd className="inline font-medium text-slate-800">
                    {formatKpiDisplayValue(item.todayReport.value, unit)}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="inline text-slate-500">Föregående: </dt>
                <dd className="inline font-medium text-slate-800">
                  {formatKpiDisplayValue(item.previousValue, unit)}
                </dd>
              </div>
            </dl>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                <span className="text-slate-500">Mål: </span>
                <span className="font-medium text-slate-800">
                  {formatKpiDisplayValue(item.kpi.targetValue, unit)}
                </span>
              </p>
              <p className="text-sm text-slate-600">
                <span className="text-slate-500">Senast rapporterat: </span>
                <span className="font-medium text-slate-800">
                  {formatKpiDisplayValue(lastValue, unit)}
                  {lastTone ? ` – ${lastTone}` : ""}
                </span>
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
              item.isReported
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
                : "bg-slate-50 text-slate-700 ring-slate-200/80"
            }`}
          >
            {item.isReported ? "Rapporterad" : "Ej rapporterad"}
          </span>
          {!isStatistic && lastTone ? <StatusBadge status={lastTone} /> : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor={`ao-value-${item.kpi.id}`}
            className="block text-xs font-medium text-slate-500"
          >
            Nytt värde{unit?.trim() ? ` (${unit.trim()})` : ""}
          </label>
          <input
            id={`ao-value-${item.kpi.id}`}
            name="value"
            type="text"
            required
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSavedMessage(null);
            }}
            disabled={isPending}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="Ange värde"
            autoComplete="off"
          />
          {!isStatistic && autoStatusEnabled ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>Ny status:</span>
              {liveComputedStatus ? (
                <StatusBadge status={liveComputedStatus} />
              ) : (
                <span className="text-slate-500">
                  Ange ett giltigt värde för beräkning
                </span>
              )}
              <span className="text-slate-500">
                (beräknas automatiskt)
              </span>
            </div>
          ) : null}
          {!isStatistic && !autoStatusEnabled ? (
            <div className="mt-2">
              <label
                htmlFor={`ao-status-${item.kpi.id}`}
                className="block text-xs font-medium text-slate-500"
              >
                Status
              </label>
              <select
                id={`ao-status-${item.kpi.id}`}
                name="status"
                value={manualStatus}
                onChange={(event) =>
                  setManualStatus(event.target.value as StatusTone)
                }
                disabled={isPending}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="Grön">Grön</option>
                <option value="Gul">Gul</option>
                <option value="Röd">Röd</option>
              </select>
            </div>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={`ao-comment-${item.kpi.id}`}
            className="block text-xs font-medium text-slate-500"
          >
            Kommentar{commentRequired ? " (obligatorisk)" : " (valfri)"}
          </label>
          <textarea
            id={`ao-comment-${item.kpi.id}`}
            name="comment"
            rows={2}
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
              setSavedMessage(null);
            }}
            required={commentRequired}
            disabled={isPending}
            placeholder={
              commentRequired
                ? "Beskriv kort varför KPI:n avviker."
                : "Valfri kommentar"
            }
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
          {commentRequired ? (
            <p className="mt-1 text-[11px] text-amber-700">
              Kommentar krävs när status blir Gul eller Röd.
            </p>
          ) : null}
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

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-xl bg-[#0b1220] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? "Sparar…"
            : item.isReported
              ? "Uppdatera rapport"
              : "Rapportera"}
        </button>
      </form>
    </article>
  );
}
