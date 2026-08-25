import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { AreaActivitiesList } from "@/components/areas/AreaActivitiesList";
import { AreaGoalsList } from "@/components/areas/AreaGoalsList";
import { AreaHistoryList } from "@/components/areas/AreaHistoryList";
import { AreaKpiList } from "@/components/areas/AreaKpiList";
import { AreaNoticesList } from "@/components/areas/AreaNoticesList";
import { AreaNoticeFormFields } from "@/components/admin/AreaNoticeFormFields";
import { AreaOperationalStatusBadge } from "@/components/areas/AreaOperationalStatusBadge";
import {
  InfoPanel,
  SectionHeader,
  SummaryCard,
} from "@/components/ui";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import { requireProfile } from "@/lib/auth/require-user";
import { canWriteGoalsForArea } from "@/lib/goals/permissions";
import { canWriteAreaNoticesForArea } from "@/lib/notices/permissions";
import { isAlwexTotaltSlug } from "@/lib/notices/visibility";
import { computeAreaOperationalStatus } from "@/lib/kpi/areaOperationalStatus";
import { fetchBusinessAreaBySlug } from "@/lib/supabase/business-areas";
import {
  createAreaNoticeAction,
  updateAreaNoticeAction,
} from "@/app/admin/aktuellt/actions";
import { getActivitiesByBusinessAreaId } from "@/services/activities";
import { getBusinessAreaHistory } from "@/services/auditLog";
import { getDecisions } from "@/services/decisions";
import { getGoalsByBusinessAreaId } from "@/services/goals";
import { getKPIsByBusinessArea } from "@/services/kpis";
import { enrichKpisForAreaDisplay } from "@/services/kpiOverview";
import {
  getAreaNoticeById,
  getCurrentAreaNoticesByBusinessAreaId,
} from "@/services/areaNotices";

type AreaDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
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

export default async function AreaDetailPage({
  params,
  searchParams,
}: AreaDetailPageProps) {
  const { slug } = await params;
  const query = (await searchParams) ?? {};
  const dbArea = await fetchBusinessAreaBySlug(slug);

  if (!dbArea) {
    notFound();
  }

  const profile = await requireProfile();
  const canCreateGoal = canWriteGoalsForArea(
    profile.role,
    profile.businessAreaId,
    dbArea.id,
  );
  const showNoticeBoard = !isAlwexTotaltSlug(dbArea.slug);
  const canWriteNotice =
    showNoticeBoard &&
    canWriteAreaNoticesForArea(
      profile.role,
      profile.businessAreaId,
      dbArea.id,
    );
  const noticeQuery = query.notice?.trim() || null;
  const showNoticeCreate = canWriteNotice && noticeQuery === "new";
  const noticeEditId =
    canWriteNotice && noticeQuery && noticeQuery !== "new"
      ? noticeQuery
      : null;
  const noticeError = query.error;

  const [
    areaGoals,
    areaActivities,
    areaKpis,
    decisions,
    areaHistory,
    areaNotices,
    editingNotice,
  ] = await Promise.all([
    getGoalsByBusinessAreaId(dbArea.id),
    getActivitiesByBusinessAreaId(dbArea.id),
    getKPIsByBusinessArea(dbArea.id),
    getDecisions(),
    getBusinessAreaHistory(dbArea.id, dbArea.slug),
    showNoticeBoard
      ? getCurrentAreaNoticesByBusinessAreaId(dbArea.id)
      : Promise.resolve([]),
    noticeEditId
      ? getAreaNoticeById(noticeEditId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const showNoticeEdit = Boolean(
    noticeEditId &&
      editingNotice &&
      editingNotice.businessAreaId === dbArea.id,
  );
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

        {showNoticeBoard ? (
          <>
            {showNoticeCreate ? (
              <form
                action={createAreaNoticeAction}
                className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
              >
                <input type="hidden" name="returnTo" value={`/areas/${slug}`} />
                <h2 className="text-sm font-semibold text-neutral-900">
                  Nytt inlägg
                </h2>
                {noticeError ? (
                  <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {noticeError}
                  </p>
                ) : null}
                <div className="mt-4 space-y-4">
                  <AreaNoticeFormFields
                    areas={[{ id: dbArea.id, name: dbArea.name }]}
                    lockedAreaId={dbArea.id}
                  />
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Spara
                  </button>
                  <Link
                    href={`/areas/${slug}`}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Avbryt
                  </Link>
                </div>
              </form>
            ) : null}

            {showNoticeEdit && editingNotice ? (
              <form
                action={updateAreaNoticeAction}
                className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
              >
                <input type="hidden" name="id" value={editingNotice.id} />
                <input type="hidden" name="returnTo" value={`/areas/${slug}`} />
                <h2 className="text-sm font-semibold text-neutral-900">
                  Ändra inlägg
                </h2>
                {noticeError ? (
                  <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {noticeError}
                  </p>
                ) : null}
                <div className="mt-4 space-y-4">
                  <AreaNoticeFormFields
                    areas={[{ id: dbArea.id, name: dbArea.name }]}
                    notice={editingNotice}
                    lockedAreaId={dbArea.id}
                  />
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Spara ändringar
                  </button>
                  <Link
                    href={`/areas/${slug}`}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Avbryt
                  </Link>
                </div>
              </form>
            ) : null}

            <AreaNoticesList
              notices={areaNotices}
              canWrite={canWriteNotice}
              newNoticeHref={`/areas/${slug}?notice=new`}
              manageHref={`/admin/aktuellt?area=${encodeURIComponent(dbArea.id)}`}
            />
          </>
        ) : null}

        <AreaKpiList items={areaKpiItems} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <AreaGoalsList
              goals={areaGoals}
              canCreate={canCreateGoal}
              newGoalHref={`/admin/goals?new=1&area=${encodeURIComponent(dbArea.id)}`}
            />
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
