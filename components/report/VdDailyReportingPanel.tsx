"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InfoPanel } from "@/components/ui";
import { CalculatedKpiReportSection } from "@/components/report/CalculatedKpiReportSection";
import { DailyKpiReportList } from "@/components/report/DailyKpiReportList";
import { MonthlyKpiReportSection } from "@/components/report/MonthlyKpiReportSection";
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
 *
 * Reporting SoT is loaded via server action into client state. After save,
 * children call onReported so we re-fetch — router.refresh() alone does not
 * update this client-held snapshot.
 */
export function VdDailyReportingPanel({
  businessAreaId,
  areas,
}: VdDailyReportingPanelProps) {
  if (!businessAreaId) {
    return (
      <div className="space-y-5">
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
      </div>
    );
  }

  return (
    <VdAreaReportingPanel
      key={businessAreaId}
      businessAreaId={businessAreaId}
      areas={areas}
    />
  );
}

function VdAreaReportingPanel({
  businessAreaId,
  areas,
}: {
  businessAreaId: string;
  areas: AreaOption[];
}) {
  const router = useRouter();
  const [reporting, setReporting] = useState<MyKpisForTodayReporting | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const areaName =
    areas.find((a) => a.id === businessAreaId)?.name ?? businessAreaId;

  const loadReporting = useCallback(
    async (areaId: string, options?: { soft?: boolean }) => {
      if (!options?.soft) {
        setLoading(true);
        setReporting(null);
      }
      setError(null);

      try {
        const result = await loadVdAreaReportingAction(areaId);
        if (!result.ok) {
          setReporting(null);
          setError(result.error);
          return;
        }
        setReporting(result.reporting);
      } catch (err) {
        console.error("[VdDailyReportingPanel] fetch failed", err);
        setError("Kunde inte hämta KPI:er.");
        setReporting(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

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

  const handleReported = useCallback(() => {
    if (!businessAreaId) return;
    void loadReporting(businessAreaId, { soft: true });
    router.refresh();
  }, [businessAreaId, loadReporting, router]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-700">Valt område: {areaName}</p>

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
        <ReportingBody reporting={reporting} onReported={handleReported} />
      )}
    </div>
  );
}

function ReportingBody({
  reporting,
  onReported,
}: {
  reporting: MyKpisForTodayReporting;
  onReported: () => void;
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
        <RatioPercentReportSection
          groups={reporting.ratioGroups}
          onReported={onReported}
        />
      ) : null}

      {reporting.items.length > 0 ? (
        <DailyKpiReportList
          items={reporting.items}
          onReported={onReported}
        />
      ) : null}

      <MonthlyKpiReportSection
        items={reporting.monthlyItems}
        onReported={onReported}
      />

      {total === 0 &&
      reporting.ratioGroups.length === 0 &&
      reporting.monthlyItems.length === 0 &&
      reporting.calculatedItems.length === 0 ? (
        <p className="rounded-2xl border border-slate-200/80 bg-white p-5 text-sm text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          Inga KPI:er är skapade för {reporting.businessAreaName}.
        </p>
      ) : null}

      <CalculatedKpiReportSection items={reporting.calculatedItems} />
    </>
  );
}
