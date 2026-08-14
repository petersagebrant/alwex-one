"use client";

import { useEffect, useState } from "react";
import { InfoPanel } from "@/components/ui";
import { CalculatedKpiReportSection } from "@/components/report/CalculatedKpiReportSection";
import { DailyKpiReportList } from "@/components/report/DailyKpiReportList";
import { RatioPercentReportSection } from "@/components/report/RatioPercentReportSection";
import { loadVdAreaReportingAction } from "@/app/report/kpis/actions";
import type { MyKpisForTodayReporting } from "@/types";

type AreaOption = {
  id: string;
  name: string;
};

type VdDailyReportingPanelProps = {
  businessAreaId: string | null;
  areas: AreaOption[];
};

/**
 * Presentational panel driven solely by `businessAreaId` from the parent.
 * Choose-area message is gated only on `!businessAreaId`.
 */
export function VdDailyReportingPanel({
  businessAreaId,
  areas,
}: VdDailyReportingPanelProps) {
  const [reporting, setReporting] = useState<MyKpisForTodayReporting | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const areaName =
    areas.find((a) => a.id === businessAreaId)?.name ?? businessAreaId;

  useEffect(() => {
    if (!businessAreaId) {
      setReporting(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setReporting(null);

    void (async () => {
      try {
        const result = await loadVdAreaReportingAction(businessAreaId);
        if (cancelled) return;
        if (!result.ok) {
          setReporting(null);
          setError(result.error);
          return;
        }
        setReporting(result.reporting);
      } catch (err) {
        if (cancelled) return;
        console.error("[VdDailyReportingPanel] fetch failed", err);
        setError("Kunde inte hämta KPI:er.");
        setReporting(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [businessAreaId]);

  return (
    <div className="space-y-5">
      {!businessAreaId ? (
        <InfoPanel
          title="Dagens KPI-rapportering"
          showLabel={false}
          compact
          className="!border-slate-200/80 !bg-white"
        >
          <p className="text-sm text-slate-700">
            Välj affärsområde för att visa dagens KPI-rapportering.
          </p>
        </InfoPanel>
      ) : (
        <>
          <p className="text-sm text-slate-700">
            Valt område: {areaName}
          </p>

          {error ? (
            <InfoPanel
              title="Dagens KPI-rapportering"
              showLabel={false}
              compact
              className="!border-slate-200/80 !bg-white"
            >
              <p className="text-sm text-slate-700">{error}</p>
            </InfoPanel>
          ) : loading || !reporting ? (
            <InfoPanel
              title="Dagens KPI-rapportering"
              showLabel={false}
              compact
              className="!border-slate-200/80 !bg-white"
            >
              <p className="text-sm text-slate-600">Hämtar KPI:er…</p>
            </InfoPanel>
          ) : (
            <ReportingBody reporting={reporting} />
          )}
        </>
      )}
    </div>
  );
}

function ReportingBody({
  reporting,
}: {
  reporting: MyKpisForTodayReporting;
}) {
  const reported = reporting.reportedCount;
  const total = reporting.totalCount;
  const progressPct = total > 0 ? Math.round((reported / total) * 100) : 0;

  return (
    <>
      <InfoPanel
        title="Dagens KPI-rapportering"
        showLabel={false}
        compact
        className="!border-slate-200/80 !bg-white"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-900">
              {reported} av {total} rapporterade
            </p>
            <p className="text-xs text-slate-500">{progressPct} %</p>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={reported}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Andel rapporterade KPI:er"
          >
            <div
              className="h-full rounded-full bg-slate-800 transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Status beräknas automatiskt när KPI:n har riktning och toleranser.
            Kommentar krävs vid Gul eller Röd.
          </p>
        </div>
      </InfoPanel>

      {reporting.ratioGroups.length > 0 ? (
        <RatioPercentReportSection groups={reporting.ratioGroups} />
      ) : null}

      {reporting.items.length > 0 ? (
        <DailyKpiReportList items={reporting.items} />
      ) : null}

      {total === 0 &&
      reporting.ratioGroups.length === 0 &&
      reporting.calculatedItems.length === 0 ? (
        <p className="rounded-2xl border border-slate-200/80 bg-white p-5 text-sm text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          Inga KPI:er är skapade för {reporting.businessAreaName}.
        </p>
      ) : null}

      <CalculatedKpiReportSection items={reporting.calculatedItems} />
    </>
  );
}
