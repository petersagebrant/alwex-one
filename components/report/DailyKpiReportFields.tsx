"use client";

import { useEffect, useRef, useState } from "react";
import { StatistikTypeBadge } from "@/components/kpis/StatistikTypeBadge";
import { StatusBadge } from "@/components/ui";
import {
  commitDailyKpiDraft,
  dailyKpiCommentRequired,
  dailyKpiDisplayStatus,
  dailyKpiHasCommittedValue,
  type DailyKpiDisplayDraft,
} from "@/lib/kpi/dailyKpiDisplay";
import { isStatisticKpi, isStatusTone } from "@/lib/kpi/kind";
import { formatDateSv } from "@/lib/format/date";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import type { DailyKpiReportItem, StatusTone } from "@/types";

export type DailyKpiReportDraft = DailyKpiDisplayDraft;

/** Shared desktop columns: KPI-namn | Mål | Föregående | Dagens värde */
export const DAILY_KPI_COMPACT_COLS =
  "md:grid-cols-[minmax(0,1.5fr)_minmax(4.75rem,6.25rem)_minmax(5.25rem,7rem)_minmax(11rem,1fr)]";

const VALUE_INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

type DailyKpiReportFieldsProps = {
  item: DailyKpiReportItem;
  reportDate: string;
  draft: DailyKpiReportDraft;
  disabled?: boolean;
  onChange: (draft: DailyKpiReportDraft) => void;
};

export function seedDailyKpiReportDraft(
  item: DailyKpiReportItem,
): DailyKpiReportDraft {
  const raw =
    item.todayReport?.status ?? item.previousStatus ?? item.kpi.status;
  const value = item.todayReport?.value ?? "";
  return {
    value,
    status: isStatusTone(raw) ? raw : "Gul",
    comment: item.todayReport?.comment ?? "",
    committedValue: value,
  };
}

export function DailyKpiReportFields({
  item,
  reportDate,
  draft,
  disabled = false,
  onChange,
}: DailyKpiReportFieldsProps) {
  const isStatistic =
    isStatisticKpi(item.kpi) || item.kpi.status === "Statistik";
  const autoStatusEnabled = !isStatistic && Boolean(item.kpi.direction);
  const effectiveStatus: StatusTone = dailyKpiDisplayStatus(item.kpi, draft);
  const commentRequired = dailyKpiCommentRequired(item.kpi, draft);
  const unit = item.kpi.unit?.trim() || "";
  const dateLabel = formatDateSv(reportDate);
  const hasValue = dailyKpiHasCommittedValue(draft);

  const commentRef = useRef<HTMLTextAreaElement>(null);
  const wasCommentRequired = useRef(commentRequired);
  const [commentRevealed, setCommentRevealed] = useState(false);

  useEffect(() => {
    if (commentRequired && !wasCommentRequired.current) {
      commentRef.current?.focus();
    }
    if (!commentRequired && wasCommentRequired.current) {
      setCommentRevealed(false);
    }
    wasCommentRequired.current = commentRequired;
  }, [commentRequired]);

  const savedComment = draft.comment.trim();
  const showCommentField = commentRequired || commentRevealed;
  const showCommentPreview = !showCommentField && savedComment.length > 0;

  return (
    <div
      className={`grid grid-cols-1 gap-1.5 px-3 py-2.5 md:gap-x-3 md:gap-y-1.5 md:px-4 md:py-2 md:grid ${DAILY_KPI_COMPACT_COLS} md:items-center`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <h3
          className="min-w-0 truncate text-sm font-semibold tracking-tight text-slate-900"
          title={item.kpi.name}
        >
          {item.kpi.name}
        </h3>
        {isStatistic ? (
          <StatistikTypeBadge className="shrink-0 px-1.5 py-0.5 text-[11px]" />
        ) : autoStatusEnabled ? (
          <>
            <input
              type="hidden"
              name={`status-${item.kpi.id}`}
              value={effectiveStatus}
            />
            {hasValue ? (
              <StatusBadge
                status={effectiveStatus}
                className="shrink-0 px-1.5 py-0.5 text-[11px]"
              />
            ) : null}
          </>
        ) : (
          <div className="shrink-0">
            <label
              htmlFor={`status-${item.kpi.id}`}
              className="mb-0.5 block text-[11px] font-medium text-slate-500"
            >
              Status
            </label>
            <select
              id={`status-${item.kpi.id}`}
              name={`status-${item.kpi.id}`}
              value={draft.status}
              onChange={(event) =>
                onChange(
                  commitDailyKpiDraft(item.kpi, {
                    ...draft,
                    status: event.target.value as StatusTone,
                  }),
                )
              }
              disabled={disabled}
              className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="Grön">Grön</option>
              <option value="Gul">Gul</option>
              <option value="Röd">Röd</option>
            </select>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-600 md:hidden">
        <span className="text-slate-500">Mål</span>{" "}
        <span className="font-medium tabular-nums text-slate-800">
          {formatKpiDisplayValue(item.kpi.targetValue, item.kpi.unit)}
        </span>
        <span className="text-slate-300"> · </span>
        <span className="text-slate-500">Föregående</span>{" "}
        <span className="font-medium tabular-nums text-slate-800">
          {formatKpiDisplayValue(item.previousValue, item.kpi.unit)}
        </span>
      </p>
      <p className="hidden text-sm tabular-nums text-slate-800 md:block">
        {formatKpiDisplayValue(item.kpi.targetValue, item.kpi.unit)}
      </p>
      <p className="hidden text-sm tabular-nums text-slate-800 md:block">
        {formatKpiDisplayValue(item.previousValue, item.kpi.unit)}
      </p>

      <div className="min-w-0">
        <label
          htmlFor={`value-${item.kpi.id}`}
          className="mb-0.5 block text-[11px] font-medium text-slate-500"
        >
          Dagens värde
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={`value-${item.kpi.id}`}
            name={`value-${item.kpi.id}`}
            type="text"
            value={draft.value}
            onChange={(event) =>
              onChange({ ...draft, value: event.target.value })
            }
            onBlur={(event) =>
              onChange(
                commitDailyKpiDraft(item.kpi, {
                  ...draft,
                  value: event.currentTarget.value,
                }),
              )
            }
            disabled={disabled}
            className={VALUE_INPUT_CLASS}
            placeholder="Tomt = hoppa över"
            autoComplete="off"
            title={`Värde för ${dateLabel}`}
          />
          {unit ? (
            <span className="shrink-0 text-xs font-medium text-slate-600">
              {unit}
            </span>
          ) : null}
        </div>
      </div>

      {showCommentField ? (
        <div className="md:col-span-4">
          <label
            htmlFor={`comment-${item.kpi.id}`}
            className="mb-0.5 block text-[11px] font-medium text-slate-500"
          >
            Kommentar{commentRequired ? " (obligatorisk)" : ""}
          </label>
          <textarea
            ref={commentRef}
            id={`comment-${item.kpi.id}`}
            name={`comment-${item.kpi.id}`}
            rows={2}
            value={draft.comment}
            onChange={(event) =>
              onChange({ ...draft, comment: event.target.value })
            }
            disabled={disabled}
            placeholder={
              commentRequired
                ? "Beskriv kort varför KPI:n avviker."
                : "Valfri kommentar"
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
          {commentRequired ? (
            <p className="mt-0.5 text-[11px] text-amber-700">
              Beskriv kort varför KPI:n avviker.
            </p>
          ) : null}
        </div>
      ) : null}

      {showCommentPreview ? (
        <div className="flex min-w-0 items-center gap-2 md:col-span-4">
          <p
            className="min-w-0 flex-1 truncate text-xs text-slate-600"
            title={draft.comment}
          >
            {draft.comment}
          </p>
          <button
            type="button"
            onClick={() => setCommentRevealed(true)}
            className="shrink-0 text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
          >
            Visa
          </button>
        </div>
      ) : null}
    </div>
  );
}
