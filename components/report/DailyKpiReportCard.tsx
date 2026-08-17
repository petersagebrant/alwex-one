"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { StatistikTypeBadge } from "@/components/kpis/StatistikTypeBadge";
import { StatusBadge } from "@/components/ui";
import { computeKpiStatus } from "@/lib/kpi/computeStatus";
import { isStatisticKpi, isStatusTone } from "@/lib/kpi/kind";
import { formatDateTimeSv } from "@/lib/format/date";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { reportDailyKpiAction } from "@/app/report/kpis/actions";
import type { DailyKpiReportItem, StatusTone } from "@/types";

type DailyKpiReportCardProps = {
  item: DailyKpiReportItem;
  expanded: boolean;
  onToggle: () => void;
  /** Called after a successful save so parent clients can reload SoT. */
  onReported?: () => void;
};

function seedStatus(item: DailyKpiReportItem): StatusTone {
  const raw =
    item.todayReport?.status ?? item.previousStatus ?? item.kpi.status;
  return isStatusTone(raw) ? raw : "Gul";
}

export function DailyKpiReportCard({
  item,
  expanded,
  onToggle,
  onReported,
}: DailyKpiReportCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(!item.isReported);
  const [value, setValue] = useState(item.todayReport?.value ?? "");
  const [status, setStatus] = useState<StatusTone>(() => seedStatus(item));
  const [comment, setComment] = useState(item.todayReport?.comment ?? "");
  const [error, setError] = useState<string | null>(null);

  const isStatistic =
    isStatisticKpi(item.kpi) || item.kpi.status === "Statistik";
  const autoStatusEnabled = !isStatistic && Boolean(item.kpi.direction);
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

  const effectiveStatus: StatusTone = liveComputedStatus ?? status;
  const commentRequired =
    !isStatistic &&
    (effectiveStatus === "Gul" || effectiveStatus === "Röd");
  const unit = item.kpi.unit;
  const showForm = expanded && editing;
  const showReportedSummary = expanded && item.isReported && !editing;
  const todayTone = isStatusTone(item.todayReport?.status)
    ? item.todayReport.status
    : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

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

      setEditing(false);
      onReported?.();
      router.refresh();
    });
  }

  function startEdit() {
    setValue(item.todayReport?.value ?? "");
    setStatus(seedStatus(item));
    setComment(item.todayReport?.comment ?? "");
    setError(null);
    setEditing(true);
  }

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer flex-wrap items-start justify-between gap-3 rounded-2xl p-4 text-left transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:p-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">
              {item.kpi.name}
            </h3>
            {isStatistic ? <StatistikTypeBadge /> : null}
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {isStatistic ? (
              <>
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
              </>
            ) : (
              <>
                <div>
                  <dt className="inline text-slate-500">Mål: </dt>
                  <dd className="inline font-medium text-slate-800">
                    {formatKpiDisplayValue(item.kpi.targetValue, unit)}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Föregående: </dt>
                  <dd className="inline font-medium text-slate-800">
                    {formatKpiDisplayValue(item.previousValue, unit)}
                  </dd>
                </div>
                {item.isReported && item.todayReport ? (
                  <div>
                    <dt className="inline text-slate-500">Idag: </dt>
                    <dd className="inline font-medium text-slate-800">
                      {formatKpiDisplayValue(item.todayReport.value, unit)}
                    </dd>
                  </div>
                ) : null}
              </>
            )}
          </dl>
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
          {!isStatistic && item.isReported && todayTone ? (
            <>
              <StatusBadge status={todayTone} />
              <p className="text-[11px] text-slate-500">
                {formatDateTimeSv(item.todayReport!.updatedAt)}
              </p>
            </>
          ) : null}
          {isStatistic && item.isReported && item.todayReport ? (
            <p className="text-[11px] text-slate-500">
              {formatDateTimeSv(item.todayReport.updatedAt)}
            </p>
          ) : null}
        </div>
      </div>

      {showReportedSummary ? (
        <div className="space-y-2 border-t border-slate-100 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          {item.todayReport?.comment ? (
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Kommentar: </span>
              {item.todayReport.comment}
            </p>
          ) : null}
          <button
            type="button"
            onClick={startEdit}
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            Ändra dagens rapport
          </button>
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          onClick={(event) => event.stopPropagation()}
          className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-4 sm:px-5 sm:pb-5"
        >
          <div
            className={`grid grid-cols-1 gap-3 ${isStatistic ? "" : "sm:grid-cols-2"}`}
          >
            <div>
              <label
                htmlFor={`value-${item.kpi.id}`}
                className="block text-xs font-medium text-slate-500"
              >
                Dagens värde{unit?.trim() ? ` (${unit.trim()})` : ""}
              </label>
              <input
                id={`value-${item.kpi.id}`}
                name="value"
                type="text"
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={isPending}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Ange värde"
                autoComplete="off"
              />
            </div>

            {!isStatistic ? (
              <div>
                <label
                  htmlFor={`status-${item.kpi.id}`}
                  className="block text-xs font-medium text-slate-500"
                >
                  Status
                </label>
                {autoStatusEnabled ? (
                  <div className="mt-1.5 space-y-1.5">
                    <input
                      type="hidden"
                      name="status"
                      value={effectiveStatus}
                    />
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <StatusBadge status={effectiveStatus} />
                      <span className="text-xs text-slate-600">
                        {liveComputedStatus
                          ? "Beräknas automatiskt"
                          : "Ange ett giltigt värde för beräkning"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Status beräknas från målvärde och tolerans.
                    </p>
                  </div>
                ) : (
                  <>
                    <select
                      id={`status-${item.kpi.id}`}
                      name="status"
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as StatusTone)
                      }
                      disabled={isPending}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="Grön">Grön</option>
                      <option value="Gul">Gul</option>
                      <option value="Röd">Röd</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Välj status manuellt.
                    </p>
                  </>
                )}
              </div>
            ) : null}
          </div>

          <div>
            <label
              htmlFor={`comment-${item.kpi.id}`}
              className="block text-xs font-medium text-slate-500"
            >
              Kommentar{commentRequired ? " (obligatorisk)" : " (valfri)"}
            </label>
            <textarea
              id={`comment-${item.kpi.id}`}
              name="comment"
              rows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
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
                Beskriv kort varför KPI:n avviker.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-rose-700" role="alert">
              {error}
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
                : item.isReported
                  ? "Uppdatera rapport"
                  : "Rapportera"}
            </button>
            {item.isReported ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Avbryt
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </article>
  );
}
