import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { AreaActivitiesList } from "@/components/areas/AreaActivitiesList";
import { AreaGoalsList } from "@/components/areas/AreaGoalsList";
import { AreaHistoryList } from "@/components/areas/AreaHistoryList";
import { AreaKpiList } from "@/components/areas/AreaKpiList";
import { AreaOperationalStatusBadge } from "@/components/areas/AreaOperationalStatusBadge";
import {
  InfoPanel,
  SectionHeader,
  SummaryCard,
} from "@/components/ui";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import { computeAreaOperationalStatus } from "@/lib/kpi/areaOperationalStatus";
import { fetchBusinessAreaBySlug } from "@/lib/supabase/business-areas";
import { getActivitiesByBusinessAreaId } from "@/services/activities";
import { getBusinessAreaHistory } from "@/services/auditLog";
import { getDecisions } from "@/services/decisions";
import { getGoalsByBusinessAreaId } from "@/services/goals";
import { getKPIsByBusinessArea } from "@/services/kpis";
import { enrichKpisForAreaDisplay } from "@/services/kpiOverview";

type AreaDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: AreaDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const dbArea = await fetchBusinessAreaBySlug(slug).catch(() => null);

  return {
    title: dbArea ? `${dbArea.name} | LEIR` : "Affärsområde | LEIR",
    description: dbArea?.description ?? undefined,
  };
}

export default async function AreaDetailPage({ params }: AreaDetailPageProps) {
  const { slug } = await params;
  const dbArea = await fetchBusinessAreaBySlug(slug);

  if (!dbArea) {
    notFound();
  }

  const [areaGoals, areaActivities, areaKpis, decisions, areaHistory] =
    await Promise.all([
      getGoalsByBusinessAreaId(dbArea.id),
      getActivitiesByBusinessAreaId(dbArea.id),
      getKPIsByBusinessArea(dbArea.id),
      getDecisions(),
      getBusinessAreaHistory(dbArea.id, dbArea.slug),
    ]);
  const areaKpiItems = await enrichKpisForAreaDisplay(areaKpis);
  const areaDecisions = decisions.filter(
    (decision) => decision.businessAreaId === dbArea.id,
  );

  const totalStatus = computeAreaOperationalStatus(areaKpis);
  const displayName = dbArea.name;
  const displayManager = dbArea.manager ?? "Ej angiven";
  const displayUpdatedAt = dbArea.updated_at;
  const displayDescription = dbArea.description;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="areas" />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8 lg:px-8">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/areas" className="hover:text-slate-800">
              Affärsområden
            </Link>
            <span aria-hidden>/</span>
            <span className="text-slate-800">{displayName}</span>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  {displayName}
                </h1>
                <AreaOperationalStatusBadge status={totalStatus} />
              </div>
              {displayDescription ? (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                  {displayDescription}
                </p>
              ) : null}
              {dbArea ? (
                <div className="mt-4">
                  <Link
                    href={`/admin/business-areas?edit=${dbArea.id}`}
                    className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Redigera
                  </Link>
                </div>
              ) : null}
            </div>

            <dl className="shrink-0 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Ansvarig chef</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {displayManager}
                </dd>
              </div>
              <div className="mt-3">
                <dt className="text-xs text-slate-500">Senast uppdaterad</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {displayUpdatedAt.includes("T")
                    ? formatDateTimeSv(displayUpdatedAt)
                    : formatDateSv(displayUpdatedAt)}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section aria-label="Sammanfattning" className="space-y-3">
          <SectionHeader
            title="Sammanfattning"
            description="Nyckeltal för affärsområdet"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="KPI" value={String(areaKpis.length)} />
            <SummaryCard
              title="Aktiviteter"
              value={String(areaActivities.length)}
            />
            <SummaryCard
              title="Beslut"
              value={String(areaDecisions.length)}
            />
            <SummaryCard title="Mål" value={String(areaGoals.length)} />
          </div>
        </section>

        <InfoPanel
          title="VD-kommentar"
          variant="vd-comment"
          showLabel={false}
        >
          {dbArea?.vd_comment?.trim()
            ? dbArea.vd_comment
            : "Ingen VD-kommentar registrerad ännu."}
        </InfoPanel>

        <AreaKpiList items={areaKpiItems} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <AreaGoalsList goals={areaGoals} />
            <AreaActivitiesList activities={areaActivities} />
          </div>
          <div className="space-y-4">
            <AreaHistoryList events={areaHistory} />
          </div>
        </div>
      </main>
    </div>
  );
}
