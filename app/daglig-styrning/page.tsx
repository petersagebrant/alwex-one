import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { OrgNoticesFeed } from "@/components/dashboard/OrgNoticesFeed";
import { ActivityEscalationHistory } from "@/components/daglig-styrning/ActivityEscalationHistory";
import { ActivityRowControls } from "@/components/daglig-styrning/ActivityRowControls";
import { AdHocActionForm } from "@/components/daglig-styrning/AdHocActionForm";
import {
  boardCardPadClass,
  boardRowClass,
} from "@/components/daglig-styrning/boardStyles";
import { CreateLinkedActionControls } from "@/components/daglig-styrning/CreateLinkedActionControls";
import { ReportRowActions } from "@/components/daglig-styrning/ReportRowActions";
import { SectionHeader } from "@/components/ui";
import { canWriteOperational } from "@/lib/auth/roles";
import { requireProfile } from "@/lib/auth/require-user";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import { toGoalOwnerOptions } from "@/lib/goals/owner";
import { stockholmCalendarDate } from "@/lib/kpi/dailyReportDate";
import { dailySteeringAttentionKpis } from "@/lib/operational-reports/attentionKpis";
import {
  COMPACT_PRIORITY_LABELS,
  followUpReportSourceLabel,
} from "@/lib/operational-reports/boardPresentation";
import { filterDriftAttentionReports } from "@/lib/operational-reports/category";
import { formatStockholmMeetingDate } from "@/lib/operational-reports/date";
import { draftDailySteeringSummary } from "@/lib/operational-reports/meetingSummary";
import { filterDailySteeringNotices } from "@/lib/operational-reports/notices";
import {
  filterEscalatedOpenActivities,
  filterOpenActivities,
  isOverdueActivity,
  sortEscalatedActivities,
  sortOpenActivities,
} from "@/lib/operational-reports/openActivities";
import { canWriteOperationalForArea } from "@/lib/operational-reports/permissions";
import { filterActiveMorningReports } from "@/lib/operational-reports/status";
import {
  countSafetyIncidentsForDay,
  formatSafetyIncidentLine,
} from "@/lib/operational-reports/safety";
import { fetchActiveProfilesForAssignment } from "@/lib/supabase/profiles";
import { getDashboardAreaNotices } from "@/services/areaNotices";
import { getActivities } from "@/services/activities";
import { getBusinessAreaOptions } from "@/services/businessAreas";
import { getKPIs } from "@/services/kpis";
import { getDailySteeringReports } from "@/services/operationalReports";
import type { OperationalReportPriority } from "@/types/operational-report";

export const metadata: Metadata = {
  title: "Daglig styrning",
  description: "Morgonvy för säkerhet, drift, KPI, rapporter och åtgärder",
};

const priorityTone: Record<OperationalReportPriority, string> = {
  urgent: "border-l-rose-500",
  follow_up: "border-l-amber-400",
  info: "border-l-sky-500",
};

export default async function DagligStyrningPage() {
  const profile = await requireProfile();
  const today = stockholmCalendarDate();
  const [reports, kpis, notices, activities, areas, owners] = await Promise.all([
    getDailySteeringReports({ today }).catch(() => ({
      active: [],
      handledToday: [],
    })),
    getKPIs().catch(() => []),
    getDashboardAreaNotices().catch(() => []),
    getActivities().catch(() => []),
    getBusinessAreaOptions().catch(() => []),
    fetchActiveProfilesForAssignment()
      .then(toGoalOwnerOptions)
      .catch(() => []),
  ]);

  const attentionKpis = dailySteeringAttentionKpis(kpis);
  const relevantNotices = filterDailySteeringNotices(notices);
  const meetingDate = formatStockholmMeetingDate();
  const incomingReports = filterActiveMorningReports(reports.active, {
    linkedReportIds: activities.map((activity) => activity.operationalReportId),
  });
  const reportById = new Map(
    [...reports.active, ...reports.handledToday].map((report) => [
      report.id,
      report,
    ]),
  );
  const safetyCounts = countSafetyIncidentsForDay(reports.active, today);
  const driftReports = filterDriftAttentionReports(reports.active);
  const openActivities = sortOpenActivities(
    filterOpenActivities(activities),
    today,
  );
  const escalatedActivities = sortEscalatedActivities(
    filterEscalatedOpenActivities(activities),
  );
  const followUpActivities = [
    ...escalatedActivities,
    ...openActivities.filter((activity) => !activity.requiresEscalation),
  ];
  const overdueCount = openActivities.filter((activity) =>
    isOverdueActivity(activity, today),
  ).length;
  const canWrite = (areaId: string) =>
    canWriteOperationalForArea(
      profile.role,
      profile.businessAreaId,
      areaId,
    );
  const lockedAreaId =
    profile.role === "ao_chef" ? profile.businessAreaId : null;
  const writableAreas = lockedAreaId
    ? areas.filter((area) => area.id === lockedAreaId)
    : areas;

  const meetingSummaryDraft = draftDailySteeringSummary({
    safetyCount:
      safetyCounts.olyckor +
      safetyCounts.tillbud +
      safetyCounts.allvarligaRisker,
    driftCount: driftReports.length,
    incomingCount: incomingReports.length,
    attentionKpiCount: attentionKpis.length,
    openActionCount: openActivities.length,
    overdueActionCount: overdueCount,
    escalationCount: escalatedActivities.length,
  });

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="daily" />

      <main
        className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        data-meeting-summary={meetingSummaryDraft.line}
      >
        <header className="mb-6 sm:mb-8">
          <p className="text-sm font-medium text-slate-500">Daglig styrning</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            {meetingDate}
          </h1>
        </header>

        <div className="space-y-8">
          <section aria-labelledby="safety-heading">
            <SectionHeader title="Säkerhet" />
            <h2 id="safety-heading" className="sr-only">
              Säkerhet
            </h2>
            <p className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold tracking-tight text-slate-900">
              {formatSafetyIncidentLine(safetyCounts)}
            </p>
          </section>

          <section aria-labelledby="kpi-heading">
            <SectionHeader title="KPI som kräver uppmärksamhet" />
            <h2 id="kpi-heading" className="sr-only">
              KPI som kräver uppmärksamhet
            </h2>
            {attentionKpis.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Inga KPI kräver uppmärksamhet just nu.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {attentionKpis.map((kpi) => (
                  <li key={kpi.id} className={boardCardPadClass}>
                    <div className={boardRowClass}>
                      <Link
                        href={kpi.href}
                        className="min-w-0 flex-1 hover:opacity-80"
                      >
                        <p className="text-sm font-semibold leading-snug text-slate-900">
                          {kpi.titleLabel}
                        </p>
                        <p className="text-sm leading-snug text-slate-700">
                          {kpi.valueLabel}
                        </p>
                      </Link>
                      {kpi.businessAreaId && canWrite(kpi.businessAreaId) ? (
                        <CreateLinkedActionControls
                          sourceType="kpi"
                          sourceId={kpi.id}
                          businessAreaId={kpi.businessAreaId}
                          defaultDeadline={today}
                          owners={owners}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="incoming-heading">
            <SectionHeader title="Inkommet från verksamheten" />
            <h2 id="incoming-heading" className="sr-only">
              Inkommet från verksamheten
            </h2>
            {incomingReports.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Inga öppna rapporter just nu.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {incomingReports.map((report) => (
                  <li
                    key={report.id}
                    className={`rounded-xl border border-slate-200 bg-white border-l-4 ${boardCardPadClass} ${priorityTone[report.priority]}`}
                  >
                    <div className={boardRowClass}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-slate-800">
                          <span className="font-semibold text-slate-900">
                            {COMPACT_PRIORITY_LABELS[report.priority]}
                          </span>
                          <span className="text-slate-400"> · </span>
                          {report.businessAreaName}
                          <span className="text-slate-400"> · </span>
                          {report.haulierName}
                          <span className="text-slate-400"> · </span>
                          <span className="text-slate-600">
                            {formatDateTimeSv(report.createdAt)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-sm leading-snug text-slate-800">
                          {report.body}
                        </p>
                      </div>
                      <ReportRowActions
                        reportId={report.id}
                        businessAreaId={report.businessAreaId}
                        status={report.status}
                        canUpdate={canWrite(report.businessAreaId)}
                        defaultDeadline={today}
                        owners={owners}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {reports.handledToday.length > 0 ? (
              <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">
                  Hanterade idag ({reports.handledToday.length})
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {reports.handledToday.map((report) => (
                    <li key={report.id} className="text-sm text-slate-600">
                      <span className="font-medium text-slate-800">
                        {report.haulierName}
                      </span>
                      {" · "}
                      {report.businessAreaName}
                      {" · "}
                      {report.body}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          <section aria-labelledby="follow-up-heading">
            <SectionHeader title="Att följa upp" />
            <h2 id="follow-up-heading" className="sr-only">
              Att följa upp
            </h2>
            {followUpActivities.length === 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-sm text-slate-500">
                  Inget att följa upp just nu.
                </p>
                {canWriteOperational(profile.role) && writableAreas.length > 0 ? (
                  <AdHocActionForm
                    areas={writableAreas}
                    defaultDeadline={today}
                    lockedAreaId={lockedAreaId}
                    owners={owners}
                    className="mt-0"
                  />
                ) : null}
              </div>
            ) : (
              <div>
                {canWriteOperational(profile.role) && writableAreas.length > 0 ? (
                  <AdHocActionForm
                    areas={writableAreas}
                    defaultDeadline={today}
                    lockedAreaId={lockedAreaId}
                    owners={owners}
                  />
                ) : null}
                <ul className="mt-3 space-y-1.5">
                  {followUpActivities.map((activity) => {
                    const overdue = isOverdueActivity(activity, today);
                    const escalated = activity.requiresEscalation;
                    const sourceLabel = followUpReportSourceLabel({
                      operationalReportId: activity.operationalReportId,
                      haulierName: activity.operationalReportId
                        ? reportById.get(activity.operationalReportId)
                            ?.haulierName
                        : null,
                    });
                    return (
                      <li
                        key={activity.id}
                        className={`rounded-xl border border-l-4 bg-white ${boardCardPadClass} ${
                          escalated
                            ? "border-slate-200 border-l-amber-500"
                            : overdue
                              ? "border-slate-200 border-l-rose-500"
                              : "border-slate-200 border-l-slate-200"
                        }`}
                      >
                        <div className={boardRowClass}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-snug text-slate-900">
                              {escalated ? (
                                <span className="mr-2 inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200/80">
                                  Eskalerat
                                </span>
                              ) : null}
                              {activity.title}
                            </p>
                            <p className="text-sm leading-snug text-slate-600">
                              {activity.businessAreaName}
                              {sourceLabel ? ` · ${sourceLabel}` : ""}
                              {activity.owner ? ` · ${activity.owner}` : ""}
                              {activity.deadline
                                ? ` · ${formatDateSv(activity.deadline)}`
                                : ""}
                            </p>
                            <ActivityEscalationHistory
                              escalations={activity.escalations}
                            />
                            {overdue ? (
                              <p className="mt-0.5 text-xs font-semibold text-rose-700">
                                Försenad
                              </p>
                            ) : null}
                          </div>
                          <ActivityRowControls
                            activityId={activity.id}
                            status={activity.status}
                            requiresEscalation={activity.requiresEscalation}
                            canUpdate={canWrite(activity.businessAreaId)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby="aktuellt-heading">
            <h2 id="aktuellt-heading" className="sr-only">
              Aktuellt i verksamheten
            </h2>
            <OrgNoticesFeed notices={relevantNotices} compactEmpty />
          </section>
        </div>
      </main>
    </div>
  );
}
