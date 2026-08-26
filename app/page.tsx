import Link from "next/link";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";
import { AppHeader } from "@/components/layout/AppHeader";
import { AoChefDashboard } from "@/components/dashboard/AoChefDashboard";
import { KpiOverviewSection } from "@/components/dashboard/KpiOverviewSection";
import { OrgNoticesFeed } from "@/components/dashboard/OrgNoticesFeed";
import { VdAttentionList } from "@/components/dashboard/VdAttentionList";
import { VdBriefingPanel } from "@/components/dashboard/VdBriefingPanel";
import { VdDiaryTimeline } from "../components/dashboard/VdDiaryTimeline";
import { AreaOperationalStatusBadge } from "@/components/areas/AreaOperationalStatusBadge";
import {
  InfoPanel,
  SectionHeader,
  StatusBadge,
  type UiStatus,
} from "@/components/ui";
import {
  buildLocalVdBriefing,
  getCachedVdBriefing,
} from "@/services/assistant";
import { getAoChefDashboardData } from "@/services/aoChefDashboard";
import { getDashboardData } from "@/services/dashboard";
import { getDashboardAreaNotices } from "@/services/areaNotices";
import { getKPIs } from "@/services/kpis";
import { getKpiOverviewData } from "@/services/kpiOverview";
import { getDashboardReportingContext } from "@/services/kpiReporting";
import { countTargetKpiStatuses } from "@/lib/kpi/kind";
import { isMonthlyRevenueVsBudgetKpi } from "@/lib/kpi/economics";
import { countUnreportedTargetKpis } from "@/lib/kpi/reportedTargetKpis";
import { getCurrentUser } from "@/lib/auth/require-user";
import { fetchProfileByUserId } from "@/lib/supabase/profiles";
import { formatDateTimeSv } from "@/lib/format/date";
import { newOrgNoticeHref } from "@/lib/notices/dashboardLinks";
import { canWriteAreaNotices } from "@/lib/notices/permissions";
import type { StatusTone } from "@/types";

function toUiStatus(status: StatusTone): UiStatus {
  return status;
}

function yesterdayChangeDot(tone: string): string {
  if (tone === "red") return "bg-rose-500";
  if (tone === "yellow") return "bg-amber-400";
  if (tone === "green") return "bg-emerald-500";
  if (tone === "blue") return "bg-sky-500";
  return "bg-slate-400";
}

function yesterdayChangeIconClass(text: string): string {
  if (text.includes("%") || text.toLowerCase().includes("kpi")) {
    return "bg-sky-500";
  }
  if (text.toLowerCase().includes("aktivitet")) {
    return "bg-amber-500";
  }
  if (text.toLowerCase().includes("beslut")) {
    return "bg-emerald-500";
  }
  return "bg-slate-400";
}

type HomeProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const error = (await searchParams)?.error;
  const currentUser = await getCurrentUser().catch(() => null);
  const profileRow = currentUser
    ? await fetchProfileByUserId(currentUser.id).catch(() => null)
    : null;
  const vdPrincipal =
    currentUser && profileRow?.role === "vd"
      ? {
          userId: currentUser.id,
          email: currentUser.email,
          role: "vd" as const,
          scope: "organization" as const,
          businessAreaId: null,
        }
      : null;

  // AO-chef: fully separate, area-scoped dashboard. VD/admin path below unchanged.
  if (
    profileRow?.role === "ao_chef" &&
    profileRow.business_area_id
  ) {
    const [aoData, orgNotices] = await Promise.all([
      getAoChefDashboardData({
        id: currentUser!.id,
        email: currentUser!.email,
        role: "ao_chef",
        businessAreaId: profileRow.business_area_id,
      }),
      getDashboardAreaNotices().catch(() => []),
    ]);
    return (
      <AoChefDashboard data={aoData} notices={orgNotices} error={error} />
    );
  }

  const [data, kpiDetails, reportingContext, kpiOverview, orgNotices] =
    await Promise.all([
      getDashboardData(),
      getKPIs().catch(() => []),
      profileRow
        ? getDashboardReportingContext({
            role: profileRow.role,
            businessAreaId: profileRow.business_area_id,
          }).catch(() => ({
            kind: "none" as const,
            myReporting: null,
            orgStats: null,
          }))
        : Promise.resolve({
            kind: "none" as const,
            myReporting: null,
            orgStats: null,
          }),
      getKpiOverviewData().catch(() => ({
        reportDate: "",
        orgStatusCounts: { Grön: 0, Gul: 0, Röd: 0 },
        alwexTotalt: null,
        areas: [],
      })),
      getDashboardAreaNotices().catch(() => []),
    ]);
  const kpis = data?.kpis ?? [];
  const businessAreas = data?.businessAreas ?? [];
  const attentionItems = data?.attentionItems ?? [];
  const actionGoals = data?.actionGoals ?? [];
  const upcomingDecisions = data?.upcomingDecisions ?? [];
  const vdFocus = data?.vdFocus ?? {
    cardTone: "green" as const,
    summary: {
      kpiFollowUpCount: 0,
      delayedActivityCount: 0,
      openDecisionCount: 0,
      redAreaCount: 0,
    },
    kpis: [],
    delayedActivities: [],
    openDecisions: [],
    priorityItems: [],
  };
  const vdAssistant = data?.vdAssistant ?? {
    greeting: "",
    situation: "",
    priority: "",
    observations: [] as string[],
    positiveSummary: "",
    highlights: [] as string[],
    intro: "",
    recommendation: "",
    riskLevel: "Låg" as const,
    riskLabel: "Låg",
    analyzedAtLabel: "",
  };
  const yesterdayChanges = data?.yesterdayChanges ?? [];
  const historyEvents = data?.historyEvents ?? [];
  const focusKpis = vdFocus.kpis ?? [];
  const attentionCounters = [
    {
      id: "kpi",
      label: "KPI att följa upp",
      value: vdFocus.summary.kpiFollowUpCount,
    },
    {
      id: "delayed",
      label: "Försenade aktiviteter",
      value: vdFocus.summary.delayedActivityCount,
    },
    {
      id: "decisions",
      label: "Öppna beslut",
      value: vdFocus.summary.openDecisionCount,
    },
    {
      id: "red",
      label: "Affärsområden med röd status",
      value: vdFocus.summary.redAreaCount,
    },
  ].filter((row) => row.value > 0);
  const orgReporting =
    reportingContext.kind === "leadership" ? reportingContext.orgStats : null;
  const reportingIncomplete =
    orgReporting != null &&
    orgReporting.total > 0 &&
    orgReporting.reported < orgReporting.total;

  const cachedAiBriefing = vdPrincipal
    ? getCachedVdBriefing(vdPrincipal)
    : null;
  const firstNameFromGreeting = vdAssistant.greeting?.match(
    /^God morgon\s+([^!.]+)/i,
  )?.[1]?.trim();
  const summaryKpiValue = (id: string) =>
    Number(kpis.find((kpi) => kpi.id === id)?.value ?? 0) || 0;
  const targetStatusCounts = countTargetKpiStatuses(
    (kpiDetails ?? []).filter((kpi) => !isMonthlyRevenueVsBudgetKpi(kpi)),
  );
  const reportedTargetCount =
    targetStatusCounts.Grön + targetStatusCounts.Gul + targetStatusCounts.Röd;
  const unreportedTargetCount = countUnreportedTargetKpis(kpiDetails ?? []);
  const localBriefing = buildLocalVdBriefing({
    firstName: firstNameFromGreeting ?? null,
    summaryText: vdAssistant.situation?.trim() ?? "",
    followUpKpis: (focusKpis ?? []).map((kpi) => ({
      name: kpi?.name ?? "",
      area: kpi?.area ?? "",
      status: kpi?.status,
      owner: kpi?.owner ?? "",
      monthlyEconomicSummary: kpi?.monthlyEconomicSummary ?? null,
    })),
    greenAreaNames: (businessAreas ?? [])
      .filter((area) => area?.status === "Grön")
      .map((area) => area?.name ?? "")
      .filter(Boolean),
    delayedActivities: (vdFocus.delayedActivities ?? []).map((activity) => ({
      title: activity?.title ?? "",
      area: activity?.area ?? "",
      owner: activity?.owner ?? "",
      deadline: activity?.deadline ?? "",
    })),
    openDecisions: (vdFocus.openDecisions ?? []).map((decision) => ({
      title: decision?.title ?? "",
      area: decision?.area ?? "",
      owner: decision?.owner ?? "",
      dueDate: decision?.dueDate ?? "",
    })),
    actionGoals: (actionGoals ?? []).map((goal) => ({
      goal: goal?.goal ?? "",
      area: goal?.area ?? "",
      owner: goal?.owner ?? "",
      status: goal?.status,
    })),
    delayedActivityCount: vdFocus.summary?.delayedActivityCount ?? 0,
    openDecisionCount: vdFocus.summary?.openDecisionCount ?? 0,
    priorityText:
      vdAssistant.priority?.trim() ||
      vdAssistant.recommendation?.trim() ||
      "",
    positiveSummary: vdAssistant.positiveSummary?.trim() ?? "",
    reportedTargetCount,
    unreportedTargetCount,
    counts: {
      areas: businessAreas?.length ?? 0,
      kpis: kpiDetails?.length ?? 0,
      goals: summaryKpiValue("goals"),
      activities: summaryKpiValue("activities"),
      decisions: Math.max(
        vdFocus.summary?.openDecisionCount ?? 0,
        vdFocus.openDecisions?.length ?? 0,
        upcomingDecisions?.length ?? 0,
      ),
    },
    analyzedAtLabel:
      vdAssistant.analyzedAtLabel?.trim() ||
      formatDateTimeSv(new Date().toISOString()),
  });
  const initialBriefing = cachedAiBriefing ?? localBriefing;

  const briefingStats = {
    areas: businessAreas?.length ?? 0,
    greenKpis: targetStatusCounts.Grön,
    yellowKpis: targetStatusCounts.Gul,
    redKpis: targetStatusCounts.Röd,
    delayedActivities: vdFocus.summary?.delayedActivityCount ?? 0,
  };

  const briefingLinkHints = [
    ...(businessAreas ?? []).map((area) => ({
      label: area.name,
      href: `/areas/${area.slug}`,
      area: area.name,
    })),
    ...(focusKpis ?? []).map((kpi) => ({
      label: kpi.name,
      href: kpi.href,
      area: kpi.area,
    })),
    ...(actionGoals ?? []).map((goal) => ({
      label: goal.goal,
      href: `/admin/goals/${goal.id}`,
      area: goal.area,
    })),
    ...(vdFocus.delayedActivities ?? []).map((activity) => ({
      label: activity.title,
      href: activity.href,
      area: activity.area,
    })),
    ...(vdFocus.openDecisions ?? []).map((decision) => ({
      label: decision.title,
      href: decision.href,
      area: decision.area,
    })),
    ...(attentionItems ?? []).map((item) => ({
      label: item.title,
      href: `/areas/${item.slug}`,
      area: item.title,
    })),
  ].filter((hint) => hint.label && hint.href);

  const canCreateOrgNotice = Boolean(
    profileRow && canWriteAreaNotices(profileRow.role),
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#eef2f6] font-sans text-slate-800">
      <AppHeader current="home" />

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <AuthErrorBanner error={error} />

        {vdPrincipal ? (
          <VdBriefingPanel
            initialContent={initialBriefing}
            hasAiCache={Boolean(cachedAiBriefing)}
            stats={briefingStats}
            linkHints={briefingLinkHints}
          />
        ) : null}

        <InfoPanel
          title="Kräver din uppmärksamhet"
          variant="info"
          showLabel={false}
          compact
          className="!border-slate-200/80 !bg-white"
        >
          {attentionCounters.length > 0 ? (
            <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {attentionCounters.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-slate-200/70 bg-white/80 px-3 py-2"
                >
                  <dt className="text-[11px] text-slate-500">{row.label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <VdAttentionList items={vdFocus.priorityItems ?? []} maxItems={5} />
        </InfoPanel>

        <OrgNoticesFeed
          notices={orgNotices}
          canCreate={canCreateOrgNotice}
          createHref={canCreateOrgNotice ? newOrgNoticeHref() : undefined}
        />

        {reportingIncomplete && orgReporting ? (
          <Link
            href="/report/kpis"
            className="group block rounded-2xl outline-none transition hover:brightness-[0.99] focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <InfoPanel
              title="Rapporteringsläge"
              showLabel={false}
              compact
              className="!border-amber-200/80 !bg-amber-50/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-700">
                  KPI rapporterade idag:{" "}
                  <span className="font-semibold text-slate-900">
                    {orgReporting.reported} av {orgReporting.total}
                  </span>
                </p>
                <span className="inline-flex items-center rounded-xl bg-[#0b1220] px-3.5 py-2 text-sm font-semibold text-white transition group-hover:bg-slate-800">
                  Rapportera KPI
                </span>
              </div>
            </InfoPanel>
          </Link>
        ) : null}

        <KpiOverviewSection data={kpiOverview} exceptionDriven />

        <InfoPanel
          title="Förändrat sedan föregående period"
          variant="info"
          showLabel={false}
          compact
          className="!border-slate-200/80 !bg-white"
        >
          {(yesterdayChanges ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">
              Inga väsentliga förändringar sedan igår.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(yesterdayChanges ?? []).map((change) => {
                const body = (
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        yesterdayChangeDot(change.tone) ||
                        yesterdayChangeIconClass(change.text)
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      {change.area ? (
                        <p className="text-sm font-semibold text-slate-900">
                          {change.area}
                        </p>
                      ) : null}
                      <p
                        className={`text-sm text-slate-700 ${
                          change.area ? "mt-0.5" : "font-medium text-slate-800"
                        }`}
                      >
                        {change.detail || change.text}
                      </p>
                      {change.owner ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Ansvarig: {change.owner}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        {change.occurredAtLabel || "Sedan igår"}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={change.id} className="py-3 first:pt-0 last:pb-0">
                    {change.href ? (
                      <Link
                        href={change.href}
                        className="group block rounded-lg outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          {body}
                          <span
                            aria-hidden
                            className="mt-0.5 shrink-0 text-base leading-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
                          >
                            ›
                          </span>
                        </div>
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </InfoPanel>

        <InfoPanel
          title="Försenade aktiviteter, öppna beslut och mål"
          variant="info"
          showLabel={false}
          compact
          className="!border-slate-200/80 !bg-white"
        >
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Försenade aktiviteter
              </h3>
              {(vdFocus.delayedActivities ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  Inga försenade aktiviteter just nu.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {(vdFocus.delayedActivities ?? []).map((activity) => (
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
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Öppna beslut
              </h3>
              {(upcomingDecisions ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  Inga beslutspunkter registrerade ännu.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {(upcomingDecisions ?? []).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{item.title}</p>
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
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Mål som kräver åtgärd
              </h3>
              <div className="mt-2 overflow-x-auto">
                {(actionGoals ?? []).length === 0 ? (
                  <p className="text-sm text-slate-600">
                    Inga mål kräver åtgärd just nu.
                  </p>
                ) : (
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
                      {(actionGoals ?? []).map((row) => (
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
                )}
              </div>
            </section>
          </div>
        </InfoPanel>

        <section aria-labelledby="areas-heading" className="space-y-4">
          <SectionHeader
            title="Affärsområden"
            description="Status, ansvar och målbild per affärsområde."
            action={
              <Link
                href="/areas"
                className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
              >
                Visa alla
              </Link>
            }
          />

          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(businessAreas ?? []).map((area) => (
              <li key={area.id}>
                <Link
                  href={`/areas/${area.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                      {area.name}
                    </h3>
                    <AreaOperationalStatusBadge status={area.status} />
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Ansvarig</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {area.manager}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Mål</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {area.goalCount}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Aktiviteter</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {area.activityCount}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-slate-500">Försenade</dt>
                      <dd className="text-right font-medium text-slate-800">
                        {area.delayedActivityCount}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-4 flex-1 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">
                    {area.comment}
                  </p>

                  <span className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#0b1220] px-4 py-2.5 text-sm font-semibold text-white transition duration-200 group-hover:bg-slate-800 group-active:scale-[0.99]">
                    Öppna målbild
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <InfoPanel
          title="Historik"
          variant="info"
          showLabel={false}
          compact
          className="!border-slate-200/80 !bg-white"
        >
          <VdDiaryTimeline events={historyEvents} />
        </InfoPanel>
      </main>
    </div>
  );
}
