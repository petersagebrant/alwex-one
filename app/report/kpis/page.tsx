import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { AoChefKpiReportList } from "@/components/report/AoChefKpiReportList";
import { AoDailyReportDatePicker } from "@/components/report/AoDailyReportDatePicker";
import { CalculatedKpiReportSection } from "@/components/report/CalculatedKpiReportSection";
import { MonthlyKpiReportSection } from "@/components/report/MonthlyKpiReportSection";
import { RatioPercentReportSection } from "@/components/report/RatioPercentReportSection";
import { VdKpiReportingView } from "@/components/report/VdKpiReportingView";
import { InfoPanel, SectionHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth/require-user";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import {
  getMyKpisForTodayReporting,
} from "@/services/kpiReporting";
import { formatDateSv } from "@/lib/format/date";
import {
  resolveDailyReportDate,
  stockholmCalendarDate,
} from "@/lib/kpi/dailyReportDate";
import type { MyKpisForTodayReporting } from "@/types";

export const metadata: Metadata = {
  title: "KPI-rapportering | LEIR",
  description: "Daglig KPI-rapportering för affärsområdeschef",
};

/** Always request-time — searchParams must not be served from a static shell. */
export const dynamic = "force-dynamic";

type ReportKpisPageProps = {
  searchParams: Promise<{ area?: string | string[]; date?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function AoChefReportingProgress({
  reporting,
}: {
  reporting: MyKpisForTodayReporting;
}) {
  const reported = reporting.reportedCount;
  const total = reporting.totalCount;
  const progressPct = total > 0 ? Math.round((reported / total) * 100) : 0;
  const dateLabel = formatDateSv(reporting.reportDate);

  return (
    <>
      <InfoPanel
        title={`KPI-rapportering ${dateLabel}`}
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
            Ange nytt värde och spara. Status beräknas automatiskt. Kommentar
            krävs vid Gul eller Röd.
          </p>
        </div>
      </InfoPanel>

      {reporting.ratioGroups.length > 0 ? (
        <RatioPercentReportSection
          groups={reporting.ratioGroups}
          reportDate={reporting.reportDate}
        />
      ) : null}

      {reporting.items.length > 0 ? (
        <AoChefKpiReportList
          items={reporting.items}
          reportDate={reporting.reportDate}
        />
      ) : null}

      <MonthlyKpiReportSection items={reporting.monthlyItems} />

      {total === 0 &&
      reporting.ratioGroups.length === 0 &&
      reporting.monthlyItems.length === 0 &&
      reporting.calculatedItems.length === 0 ? (
        <p className="rounded-2xl border border-slate-200/80 bg-white p-5 text-sm text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          Inga KPI:er är skapade för {reporting.businessAreaName}.
        </p>
      ) : null}

      <CalculatedKpiReportSection
        items={reporting.calculatedItems}
        reportDate={reporting.reportDate}
      />
    </>
  );
}

function ReportPageActions({ showManageKpis }: { showManageKpis: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {showManageKpis ? (
        <Link
          href="/admin/kpis"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          Hantera KPI:er
        </Link>
      ) : null}
      <Link
        href="/"
        className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
      >
        Till Dashboard
      </Link>
    </div>
  );
}

export default async function ReportKpisPage({
  searchParams,
}: ReportKpisPageProps) {
  const profile = await requireProfile();
  const params = await searchParams;
  const reportDate = resolveDailyReportDate(firstParam(params.date));
  const maxDate = stockholmCalendarDate();
  const reportDateLabel = formatDateSv(reportDate);

  const isAoChef = profile.role === "ao_chef";
  const isLeadership =
    profile.role === "vd" || profile.role === "administrator";

  if (!isAoChef && !isLeadership) {
    redirect("/");
  }

  if (isAoChef) {
    if (!profile.businessAreaId) {
      return (
        <div className="flex min-h-full flex-1 flex-col bg-[#eef2f6] font-sans text-slate-800">
          <AppHeader current="kpis" />
          <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionHeader title="KPI-rapportering" />
              <ReportPageActions showManageKpis={false} />
            </div>
            <InfoPanel title="KPI-rapportering" showLabel={false} compact>
              <p>
                Ditt konto saknar kopplat affärsområde. Kontakta administratör.
              </p>
            </InfoPanel>
          </main>
        </div>
      );
    }

    // AO-chef: ignore any `area` query param; always force own business_area_id.
    const reporting = await getMyKpisForTodayReporting(profile, reportDate);

    return (
      <div className="flex min-h-full flex-1 flex-col bg-[#eef2f6] font-sans text-slate-800">
        <AppHeader current="kpis" />

        <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeader
              title="KPI-rapportering"
              description={`${reporting?.businessAreaName ?? "Affärsområde"} · ${reportDateLabel}`}
            />
            <ReportPageActions showManageKpis={false} />
          </div>

          <AoDailyReportDatePicker value={reportDate} max={maxDate} />

          {reporting ? <AoChefReportingProgress reporting={reporting} /> : null}
        </main>
      </div>
    );
  }

  // VD / administrator: area is client state; date defaults to yesterday.
  const areas = await fetchBusinessAreas().catch(() => []);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#eef2f6] font-sans text-slate-800">
      <AppHeader current="kpis" />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeader
            title="KPI-rapportering"
            description="Välj affärsområde och rapportdatum"
          />
          <ReportPageActions showManageKpis />
        </div>

        <VdKpiReportingView
          areas={areas.map((area) => ({ id: area.id, name: area.name }))}
          defaultReportDate={reportDate}
          maxReportDate={maxDate}
        />
      </main>
    </div>
  );
}
