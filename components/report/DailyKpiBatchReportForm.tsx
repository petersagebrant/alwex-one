"use client";

import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { reportDailyKpisBatchAction } from "@/app/report/kpis/actions";
import {
  DAILY_KPI_COMPACT_COLS,
  DailyKpiReportFields,
  seedDailyKpiReportDraft,
  type DailyKpiReportDraft,
} from "@/components/report/DailyKpiReportFields";
import { RatioPercentReportFields } from "@/components/report/RatioPercentReportFields";
import {
  commitDailyKpiDraft,
  computedDailyKpiDraftStatus,
} from "@/lib/kpi/dailyKpiDisplay";
import {
  collectBatchDailyReports,
  dailyKpiValidationKpiFromKpi,
  EMPTY_DAILY_BATCH_MESSAGE,
  formatBatchDailyReportError,
} from "@/lib/kpi/dailyKpiReport";
import { isStatusTone } from "@/lib/kpi/kind";
import type {
  DailyKpiReportItem,
  RatioPercentReportGroup,
} from "@/types";

type DailyKpiBatchReportFormProps = {
  businessAreaId: string;
  reportDate: string;
  items: DailyKpiReportItem[];
  ratioGroups: RatioPercentReportGroup[];
  onReported?: () => void;
  header?: ReactNode;
};

function DailyKpiBatchSaveBar({ isPending }: { isPending: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-xl bg-[#0b1220] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Sparar…" : "Spara dagens rapportering"}
      </button>
      <p className="text-xs text-slate-500">
        Tomt fält hoppas över. {EMPTY_DAILY_BATCH_MESSAGE}
      </p>
    </div>
  );
}

function seedDrafts(
  items: DailyKpiReportItem[],
  ratioGroups: RatioPercentReportGroup[],
): Record<string, DailyKpiReportDraft> {
  const drafts: Record<string, DailyKpiReportDraft> = {};
  for (const item of items) {
    drafts[item.kpi.id] = seedDailyKpiReportDraft(item);
  }
  for (const group of ratioGroups) {
    drafts[group.numerator.kpi.id] = seedDailyKpiReportDraft(group.numerator);
    drafts[group.denominator.kpi.id] = seedDailyKpiReportDraft(
      group.denominator,
    );
  }
  return drafts;
}

export function DailyKpiBatchReportForm({
  businessAreaId,
  reportDate,
  items,
  ratioGroups,
  onReported,
  header,
}: DailyKpiBatchReportFormProps) {
  const seedKey = [
    reportDate,
    ...items.map(
      (item) =>
        `${item.kpi.id}:${item.todayReport?.updatedAt ?? ""}:${item.todayReport?.value ?? ""}`,
    ),
    ...ratioGroups.map(
      (group) =>
        `${group.numerator.kpi.id}:${group.numerator.todayReport?.updatedAt ?? ""}:${group.denominator.kpi.id}:${group.denominator.todayReport?.updatedAt ?? ""}`,
    ),
  ].join("|");

  if (items.length === 0 && ratioGroups.length === 0) {
    return header ?? null;
  }

  return (
    <DailyKpiBatchReportFormFields
      key={seedKey}
      businessAreaId={businessAreaId}
      reportDate={reportDate}
      items={items}
      ratioGroups={ratioGroups}
      onReported={onReported}
      header={header}
    />
  );
}

function DailyKpiBatchReportFormFields({
  businessAreaId,
  reportDate,
  items,
  ratioGroups,
  onReported,
  header,
}: DailyKpiBatchReportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState(() => seedDrafts(items, ratioGroups));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const kpis = useMemo(() => {
    const list = [
      ...ratioGroups.flatMap((group) => [
        group.result.kpi,
        group.numerator.kpi,
        group.denominator.kpi,
      ]),
      ...items.map((item) => item.kpi),
    ];
    return list.map(dailyKpiValidationKpiFromKpi);
  }, [items, ratioGroups]);

  const itemsById = useMemo(() => {
    const map = new Map<string, DailyKpiReportItem>();
    for (const item of items) map.set(item.kpi.id, item);
    for (const group of ratioGroups) {
      map.set(group.numerator.kpi.id, group.numerator);
      map.set(group.denominator.kpi.id, group.denominator);
    }
    return map;
  }, [items, ratioGroups]);

  function updateDraft(kpiId: string, next: DailyKpiReportDraft) {
    setDrafts((current) => ({ ...current, [kpiId]: next }));
    setError(null);
    setMessage(null);
  }

  function patchDraftValue(item: DailyKpiReportItem, value: string) {
    setDrafts((current) => {
      const draft = current[item.kpi.id] ?? seedDailyKpiReportDraft(item);
      return { ...current, [item.kpi.id]: { ...draft, value } };
    });
    setError(null);
    setMessage(null);
  }

  function commitItemDraft(item: DailyKpiReportItem, value?: string) {
    setDrafts((current) => {
      const draft = current[item.kpi.id] ?? seedDailyKpiReportDraft(item);
      const next = value !== undefined ? { ...draft, value } : draft;
      return {
        ...current,
        [item.kpi.id]: commitDailyKpiDraft(item.kpi, next),
      };
    });
  }

  function commitAllDrafts(
    current: Record<string, DailyKpiReportDraft>,
  ): Record<string, DailyKpiReportDraft> {
    const next: Record<string, DailyKpiReportDraft> = {};
    for (const [kpiId, draft] of Object.entries(current)) {
      const item = itemsById.get(kpiId);
      next[kpiId] = item
        ? commitDailyKpiDraft(item.kpi, draft)
        : { ...draft, committedValue: draft.value };
    }
    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const committed = commitAllDrafts(drafts);
    setDrafts(committed);

    const reportDrafts = Object.entries(committed).map(([kpiId, draft]) => {
      const item = itemsById.get(kpiId);
      const status = item
        ? computedDailyKpiDraftStatus(item.kpi, draft)
        : isStatusTone(draft.status)
          ? draft.status
          : "Gul";
      return {
        kpiId,
        value: draft.value,
        status,
        comment: draft.comment,
      };
    });

    const collected = collectBatchDailyReports({
      reportDate,
      kpis,
      drafts: reportDrafts,
    });
    if (!collected.ok) {
      setError(formatBatchDailyReportError(collected.kpiNames));
      return;
    }

    startTransition(async () => {
      const result = await reportDailyKpisBatchAction({
        businessAreaId,
        reportDate,
        reports: reportDrafts,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? null);
      onReported?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        {header}
        <DailyKpiBatchSaveBar isPending={isPending} />
      </div>

      {ratioGroups.length > 0 ? (
        <ul className="space-y-3">
          {ratioGroups.map((group) => (
            <li key={group.result.kpi.id}>
              <RatioPercentReportFields
                group={group}
                reportDate={reportDate}
                numeratorValue={drafts[group.numerator.kpi.id]?.value ?? ""}
                denominatorValue={
                  drafts[group.denominator.kpi.id]?.value ?? ""
                }
                committedNumeratorValue={
                  drafts[group.numerator.kpi.id]?.committedValue ?? ""
                }
                committedDenominatorValue={
                  drafts[group.denominator.kpi.id]?.committedValue ?? ""
                }
                disabled={isPending}
                onNumeratorChange={(value) =>
                  patchDraftValue(group.numerator, value)
                }
                onDenominatorChange={(value) =>
                  patchDraftValue(group.denominator, value)
                }
                onNumeratorBlur={(value) =>
                  commitItemDraft(group.numerator, value)
                }
                onDenominatorBlur={(value) =>
                  commitItemDraft(group.denominator, value)
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {items.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          <div
            className={`hidden border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-[11px] font-medium tracking-wide text-slate-500 uppercase md:grid md:gap-x-3 ${DAILY_KPI_COMPACT_COLS}`}
          >
            <span>KPI</span>
            <span>Mål</span>
            <span>Föregående</span>
            <span>Dagens värde</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.kpi.id}>
                <DailyKpiReportFields
                  item={item}
                  reportDate={reportDate}
                  draft={
                    drafts[item.kpi.id] ?? seedDailyKpiReportDraft(item)
                  }
                  disabled={isPending}
                  onChange={(draft) => updateDraft(item.kpi.id, draft)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <DailyKpiBatchSaveBar isPending={isPending} />
    </form>
  );
}
