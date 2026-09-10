import Link from "next/link";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";
import { AppHeader } from "@/components/layout/AppHeader";
import { OrgNoticesFeed } from "@/components/dashboard/OrgNoticesFeed";
import { VdAreaOverview } from "@/components/dashboard/VdAreaOverview";
import { VdBriefingPanel } from "@/components/dashboard/VdBriefingPanel";
import { InfoPanel, StatusBadge, type UiStatus } from "@/components/ui";
import {
  selectVdDashboardActionGoals,
  VD_ACTION_GOALS_EMPTY_MESSAGE,
  VD_GOALS_VIEW_HREF,
} from "@/lib/dashboard/vdActionGoals";
import type { VdAreaOverviewRow } from "@/lib/kpi/vdAreaOverview";
import { newOrgNoticeHref } from "@/lib/notices/dashboardLinks";
import type { AreaNoticeListItem } from "@/services/areaNotices";
import type {
  DashboardActionGoal,
  DashboardDecisionItem,
  DashboardVdFocus,
} from "@/services/dashboard";
import type { StatusTone } from "@/types";
import type {
  VdBriefingLinkHint,
  VdBriefingStats,
} from "@/components/dashboard/VdBriefing";

function toUiStatus(status: StatusTone): UiStatus {
  return status;
}

type VdLeadershipDashboardProps = {
  error?: string;
  initialBriefing: string;
  hasAiCache: boolean;
  briefingStats: VdBriefingStats;
  briefingLinkHints: VdBriefingLinkHint[];
  notices: AreaNoticeListItem[];
  canCreateOrgNotice: boolean;
  reportingIncomplete: boolean;
  orgReporting: { reported: number; total: number } | null;
  areaRows: VdAreaOverviewRow[];
  delayedActivities: DashboardVdFocus["delayedActivities"];
  upcomingDecisions: DashboardDecisionItem[];
  actionGoals: DashboardActionGoal[];
  greetingName?: string | null;
};

/**
 * VD / Vice VD org dashboard: briefing, Aktuellt, compact AO scan.
 * Does not change AO-chef layout or underlying fetches.
 */
export function VdLeadershipDashboard({
  error,
  initialBriefing,
  hasAiCache,
  briefingStats,
  briefingLinkHints,
  notices,
  canCreateOrgNotice,
  reportingIncomplete,
  orgReporting,
  areaRows,
  delayedActivities,
  upcomingDecisions,
  actionGoals,
  greetingName,
}: VdLeadershipDashboardProps) {
  const delayed = delayedActivities ?? [];
  const decisions = upcomingDecisions ?? [];
  const { items: goals, hasMore } = selectVdDashboardActionGoals(actionGoals);
  const remainingReports =
    orgReporting != null
      ? Math.max(0, orgReporting.total - orgReporting.reported)
      : 0;
  const hasActionExceptions =
    delayed.length > 0 || decisions.length > 0 || goals.length > 0;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#eef2f6] font-sans text-slate-800">
      <AppHeader current="home" />

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <AuthErrorBanner error={error} />

        <VdBriefingPanel
          initialContent={initialBriefing}
          hasAiCache={hasAiCache}
          stats={briefingStats}
          linkHints={briefingLinkHints}
          givenName={greetingName}
        />

        <OrgNoticesFeed
          notices={notices}
          canCreate={canCreateOrgNotice}
          createHref={canCreateOrgNotice ? newOrgNoticeHref() : undefined}
        />

        {reportingIncomplete && orgReporting ? (
          <Link
            href="/report/kpis"
            className="group flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2 outline-none transition hover:brightness-[0.99] focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <p className="min-w-0 flex-1 text-sm leading-snug text-slate-700">
              <span className="font-medium text-slate-500">Rapportering</span>
              <span className="text-slate-400"> · </span>
              <span className="font-semibold text-slate-900">
                {orgReporting.reported}/{orgReporting.total}
              </span>{" "}
              KPI rapporterade idag
              {remainingReports > 0 ? (
                <>
                  {" "}
                  · {remainingReports} återstår
                </>
              ) : null}
            </p>
            <span className="inline-flex shrink-0 items-center rounded-lg bg-[#0b1220] px-3 py-1.5 text-sm font-semibold text-white transition group-hover:bg-slate-800">
              Rapportera KPI
            </span>
          </Link>
        ) : null}

        <VdAreaOverview rows={areaRows} />

        {hasActionExceptions ? (
          <InfoPanel
            title="Kräver åtgärd"
            variant="info"
            showLabel={false}
            compact
            className="!border-slate-200/80 !bg-white"
          >
            <div className="space-y-6">
              {delayed.length > 0 ? (
                <section>
                  <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                    Försenade aktiviteter
                  </h3>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {delayed.map((activity) => (
                      <li
                        key={activity.id}
                        className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">
                            {activity.title}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {activity.area}
                            {activity.owner ? ` · ${activity.owner}` : ""}
                            {activity.deadline ? ` · ${activity.deadline}` : ""}
                          </p>
                        </div>
                        <Link
                          href={activity.href}
                          className="shrink-0 text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                        >
                          Öppna
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {decisions.length > 0 ? (
                <section>
                  <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                    Öppna beslut
                  </h3>
                  <ul className="mt-2 divide-y divide-slate-100">
                    {decisions.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                      >
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {item.detail}
                          </p>
                        </div>
                        <Link
                          href={`/admin/decisions/${item.id}`}
                          className="shrink-0 text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                        >
                          Öppna
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {goals.length > 0 ? (
                <section>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                      Mål som kräver åtgärd
                    </h3>
                    {hasMore ? (
                      <Link
                        href={VD_GOALS_VIEW_HREF}
                        className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                      >
                        Visa alla mål →
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600">
                          <th className="rounded-l-lg px-3 py-2.5 font-semibold">
                            Mål
                          </th>
                          <th className="px-3 py-2.5 font-semibold">
                            Affärsområde
                          </th>
                          <th className="px-3 py-2.5 font-semibold">Ansvarig</th>
                          <th className="px-3 py-2.5 font-semibold">Deadline</th>
                          <th className="rounded-r-lg px-3 py-2.5 font-semibold">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {goals.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-900">
                              <Link
                                href={`/admin/goals/${row.id}`}
                                className="hover:underline"
                              >
                                {row.goal}
                              </Link>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                              {row.area}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                              {row.owner}
                            </td>
                            <td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 text-slate-700">
                              {row.deadline}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-3">
                              <StatusBadge status={toUiStatus(row.status)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </div>
          </InfoPanel>
        ) : (
          <InfoPanel
            title="Kräver åtgärd"
            variant="info"
            showLabel={false}
            compact
            className="!border-slate-200/80 !bg-white"
          >
            <p className="text-sm text-slate-600">
              {VD_ACTION_GOALS_EMPTY_MESSAGE}
            </p>
          </InfoPanel>
        )}
      </main>
    </div>
  );
}
