import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

function sliceExport(source: string, name: string): string {
  const markers = [
    `export async function ${name}`,
    `export function ${name}`,
    `export type ${name}`,
  ];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  assert.ok(start != null && start >= 0, `missing ${name}`);
  const next = source.indexOf("\nexport ", start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

describe("daglig styrning page", () => {
  it("reuses existing KPI classification, activities and notices, without charts", () => {
    const page = read("./page.tsx");
    const actions = read("./actions.ts");
    assert.match(page, /getDailySteeringReports/);
    assert.match(page, /getKPIs/);
    assert.match(page, /dailySteeringAttentionKpis/);
    assert.match(page, /getActivities/);
    assert.match(page, /getDashboardAreaNotices/);
    assert.match(page, /filterDailySteeringNotices/);
    assert.match(page, /OrgNoticesFeed/);
    assert.match(page, /compactEmpty/);
    assert.match(page, /Säkerhet/);
    assert.match(page, /KPI som kräver uppmärksamhet/);
    assert.match(page, /Inkommet från verksamheten/);
    assert.match(page, /Att följa upp/);
    assert.match(page, /Aktuellt i verksamheten/);
    assert.match(page, /filterOpenActivities/);
    assert.match(page, /filterEscalatedOpenActivities/);
    assert.match(page, /sortOpenActivities/);
    assert.match(page, /sortEscalatedActivities/);
    assert.match(page, /AdHocActionForm/);
    assert.doesNotMatch(page, /Drift idag/);
    assert.doesNotMatch(page, /Öppna åtgärder/);
    assert.doesNotMatch(page, /Eskalerat \/ kräver beslut/);
    assert.match(page, /draftDailySteeringSummary/);
    assert.match(page, /fetchActiveProfilesForAssignment/);
    assert.match(page, /toGoalOwnerOptions/);
    assert.doesNotMatch(page, /chart|Chart|recharts/i);
    assert.doesNotMatch(page, /service_role|SERVICE_ROLE/);
    assert.doesNotMatch(actions, /createDecision|insertDecision/);
    const safetyAt = page.indexOf("Säkerhet");
    const kpiAt = page.indexOf("KPI som kräver uppmärksamhet");
    const incomingAt = page.indexOf("Inkommet från verksamheten");
    const followUpAt = page.indexOf("Att följa upp");
    const aktuelltAt = page.indexOf("Aktuellt i verksamheten");
    assert.ok(safetyAt > 0 && safetyAt < kpiAt);
    assert.ok(kpiAt < incomingAt && incomingAt < followUpAt);
    assert.ok(followUpAt < aktuelltAt);
  });

  it("keeps KPI and report rows compact until Åtgärd or Eskalera", () => {
    const page = read("./page.tsx");
    const actions = read("./actions.ts");
    const linked = read("../../components/daglig-styrning/CreateLinkedActionControls.tsx");
    const rowActions = read("../../components/daglig-styrning/ReportRowActions.tsx");
    const adHoc = read("../../components/daglig-styrning/AdHocActionForm.tsx");
    const ownerSelect = read("../../components/daglig-styrning/OwnerSelect.tsx");
    const activityControls = read(
      "../../components/daglig-styrning/ActivityRowControls.tsx",
    );
    const reportStatusControls = read(
      "../../components/daglig-styrning/ReportStatusControls.tsx",
    );
    const handleReportStatusButton = read(
      "../../components/daglig-styrning/HandleReportStatusButton.tsx",
    );
    const boardPresentation = read(
      "../../lib/operational-reports/boardPresentation.ts",
    );
    const boardStyles = read("../../components/daglig-styrning/boardStyles.ts");
    assert.match(page, /kpi\.titleLabel/);
    assert.match(linked, />\s*Åtgärd\s*</);
    assert.doesNotMatch(linked, /Skapa åtgärd/);
    assert.match(linked, /createSteeringActivityAction/);
    assert.doesNotMatch(linked, /BoardOverflowMenu/);
    assert.doesNotMatch(linked, /•••/);
    assert.match(linked, /extraOverflow/);
    assert.match(linked, /Eskalera/);
    assert.match(linked, /Vad behöver du hjälp\/beslut med\?/);
    assert.match(linked, /OwnerSelect/);
    assert.match(linked, /Klart senast/);
    assert.match(boardStyles, /boardActionClusterClass/);
    assert.match(boardStyles, /boardRowClass/);
    assert.match(boardStyles, /boardCardPadClass/);
    assert.match(boardStyles, /px-4 py-1\.5/);
    assert.match(boardStyles, /items-center justify-between gap-2/);
    assert.match(
      boardStyles,
      /boardActionClusterClass =\s*"relative z-10 flex shrink-0 items-center justify-end gap-1"/,
    );
    assert.doesNotMatch(
      boardStyles,
      /boardActionClusterClass =\s*"flex w-full/,
    );
    assert.match(page, /boardRowClass/);
    assert.match(page, /boardCardPadClass/);
    assert.match(page, /relative z-0 min-w-0 flex-1 overflow-hidden/);
    assert.doesNotMatch(page, /items-start justify-between gap-3/);
    assert.doesNotMatch(page, /px-4 py-2\.5/);
    assert.match(linked, /boardActionClusterClass/);
    assert.match(activityControls, /boardActionClusterClass/);
    assert.match(rowActions, /boardActionClusterClass/);
    assert.match(rowActions, /name="status" value="klar"/);
    assert.match(rowActions, />\s*Stäng\s*</);
    assert.doesNotMatch(rowActions, /Stäng rapport/);
    assert.doesNotMatch(rowActions, /BoardOverflowMenu/);
    assert.match(rowActions, /updateOperationalReportStatusAction/);
    assert.match(ownerSelect, /name = "ownerId"/);
    assert.doesNotMatch(linked, /placeholder="Ansvarig"/);
    assert.doesNotMatch(linked, /Kräver beslut/);
    assert.match(adHoc, /\+ Lägg till åtgärd/);
    assert.match(adHoc, /OwnerSelect/);
    assert.match(boardPresentation, /label: "Öppen"/);
    assert.match(boardPresentation, /label: "Pågår"/);
    assert.match(boardPresentation, /label: "Klar"/);
    assert.doesNotMatch(boardPresentation, /label: "Starta"/);
    assert.match(boardPresentation, /nextSteeringBoardStatus/);
    assert.match(activityControls, /nextSteeringBoardStatus/);
    assert.match(activityControls, /patchSteeringActivityAction/);
    assert.doesNotMatch(activityControls, />\s*Starta\s*</);
    assert.doesNotMatch(activityControls, /Öppen/);
    assert.doesNotMatch(activityControls, /Pågår/);
    assert.match(activityControls, /\{nextStatus\.label\}/);
    assert.match(activityControls, /name="status" value=\{nextStatus\.value\}/);
    assert.doesNotMatch(activityControls, /BoardOverflowMenu/);
    assert.match(activityControls, /hasAnsweredEscalation\(escalations\)/);
    assert.match(activityControls, /showEscalate =/);
    assert.match(activityControls, /showKlar = Boolean\(nextStatus\) && canComplete/);
    assert.match(activityControls, /Eskalera/);
    assert.match(page, /canCompleteFollowUpActivity/);
    assert.match(page, /escalations=\{activity\.escalations\}/);
    assert.match(page, /<ActivityEscalationHistory/);
    assert.ok(
      page.indexOf("<ActivityEscalationHistory") <
        page.indexOf("<ActivityRowControls"),
    );
    assert.match(boardStyles, /boardStartButtonClass/);
    assert.match(boardStyles, /ds-btn-start/);
    assert.match(boardStyles, /bg-\[#0369a1\]/);
    assert.match(boardStyles, /hover:bg-\[#075985\]/);
    assert.doesNotMatch(boardStyles, /bg-sky-700/);
    assert.match(boardStyles, /boardEscalateButtonClass/);
    assert.match(boardStyles, /ds-btn-escalate/);
    assert.match(boardStyles, /bg-\[#c2410c\]/);
    assert.doesNotMatch(boardStyles, /boardEscalateButtonClass[\s\S]*bg-red-/);
    assert.match(boardStyles, /boardCompleteButtonClass/);
    assert.match(boardStyles, /ds-btn-done/);
    assert.match(boardStyles, /bg-\[#047857\]/);
    assert.match(boardStyles, /boardPrimaryButtonClass[\s\S]*bg-\[#0b1220\]/);
    assert.match(boardStyles, /boardInProgressStatusBadgeClass/);
    assert.match(boardStyles, /bg-amber-50/);
    assert.match(boardStyles, /text-amber-900/);
    assert.match(boardStyles, /border-amber-200/);
    assert.match(boardStyles, /boardDoneStatusBadgeClass/);
    assert.match(boardStyles, /bg-emerald-50/);
    assert.match(boardStyles, /text-emerald-800/);
    assert.match(boardStyles, /border-emerald-200/);
    assert.match(boardStyles, /boardNewStatusBadgeClass/);
    assert.match(boardStyles, /bg-sky-50/);
    assert.match(boardStyles, /text-sky-800/);
    assert.match(boardStyles, /border-sky-200/);
    assert.match(boardStyles, /cursor-pointer/);
    assert.match(boardStyles, /relative z-10 appearance-none cursor-pointer/);
    assert.match(
      boardStyles.match(/const boardButtonClass =[\s\S]*?;/)?.[0] ?? "",
      /appearance-none/,
    );
    assert.doesNotMatch(
      boardStyles.match(/const boardButtonClass =[\s\S]*?;/)?.[0] ?? "",
      /pointer-events-none/,
    );
    assert.doesNotMatch(
      boardStyles.match(/export const boardStartButtonClass =[\s\S]*?;/)?.[0] ?? "",
      /pointer-events-none/,
    );
    assert.match(boardStyles, /boardNewStatusBadgeClass[\s\S]*pointer-events-none/);
    assert.match(
      handleReportStatusButton,
      /className="inline-flex h-7 shrink-0 items-center whitespace-nowrap px-2 text-xs relative z-10 appearance-none cursor-pointer transition-colors rounded-md bg-\[#0284c7\] font-semibold text-white hover:bg-\[#075985\]"/,
    );
    assert.match(handleReportStatusButton, /type="button"/);
    assert.doesNotMatch(handleReportStatusButton, /type="submit"/);
    assert.doesNotMatch(handleReportStatusButton, /requestSubmit\(\)/);
    assert.match(handleReportStatusButton, /updateOperationalReportStatusAction/);
    assert.match(handleReportStatusButton, /formData.set\("status", "hanteras"\)/);
    assert.match(handleReportStatusButton, /router.refresh\(\)/);
    assert.match(handleReportStatusButton, /disabled=\{pending\}/);
    assert.match(reportStatusControls, /HandleReportStatusButton reportId=\{reportId\}/);
    assert.doesNotMatch(reportStatusControls, /type="submit"/);
    assert.match(reportStatusControls, /status === "ny"/);
    assert.doesNotMatch(reportStatusControls, /\bdisabled\b/);
    assert.doesNotMatch(reportStatusControls, /aria-disabled/);
    assert.doesNotMatch(
      reportStatusControls,
      /boardStartButtonClass[\s\S]{0,80}pointer-events-none/,
    );
    assert.match(linked, /boardPrimaryButtonClass/);
    assert.match(linked, /boardEscalateButtonClass/);
    assert.match(rowActions, /boardGhostButtonClass/);
    assert.match(activityControls, /boardNextStatusButtonClass/);
    assert.doesNotMatch(activityControls, /boardActivityStatusBadgeClass/);
    assert.match(activityControls, /boardEscalateButtonClass/);
    assert.doesNotMatch(activityControls, /Besvarad/);
    assert.doesNotMatch(activityControls, /end-escalation/);
    assert.doesNotMatch(activityControls, /STEERING_BOARD_STATUS_ACTIONS\.map/);
    assert.doesNotMatch(activityControls, /name="owner"/);
    assert.match(actions, /ownerId/);
    assert.match(actions, /statusAfterCreatingLinkedAction/);
    assert.match(actions, /nextStatus !== linkedReportStatus/);
    assert.match(actions, /recordActivityEscalation/);
    assert.match(actions, /answerEscalationAction/);
    assert.match(actions, /canAnswerEscalation/);
    assert.doesNotMatch(actions, /end-escalation/);
    assert.doesNotMatch(
      actions,
      /answerActivityEscalation[\s\S]*status: "Klar"/,
    );
    assert.doesNotMatch(actions, /formData\.get\("owner"\)/);
    assert.match(page, /countSafetyIncidentsForDay\(reports\.active/);
    assert.match(page, /filterIncomingBoardReports\(reports\.active/);
    assert.match(page, /filterFollowUpBoardReports\(reports\.active/);
    assert.match(page, /linkedReportIds/);
    assert.match(
      page,
      /activities\.map\(\(activity\) => activity\.operationalReportId\)/,
    );
    assert.match(page, /incomingReports\.map\(\(report\) =>/);
    assert.match(page, /followUpReports\.map\(\(report\) =>/);
    assert.doesNotMatch(page, /reports\.active\.map\(\(report\) =>/);
    assert.match(page, /followUpActivities\.map\(\(activity\) =>/);
    assert.match(page, /ActivityEscalationHistory/);
    assert.match(page, /followUpReportSourceLabel/);
    assert.match(page, /Hanterade idag/);
    assert.doesNotMatch(page, /<details[^>]*\sopen/);
  });

  it("keeps activities when activity_escalations cannot be loaded", () => {
    const getActivities = sliceExport(
      read("../../services/activities.ts"),
      "getActivities",
    );
    const page = read("./page.tsx");
    assert.match(getActivities, /loadEscalationsByActivityIds/);
    assert.match(getActivities, /\.catch\(\(\) => new Map\(\)\)/);
    assert.match(
      page,
      /activities\.map\(\(activity\) => activity\.operationalReportId\)/,
    );
  });

  it("links Åtgärd via operational_report_id and never deletes or auto-klars the report", () => {
    const actions = read("./actions.ts");
    const create = sliceExport(actions, "createSteeringActivityAction");
    assert.match(create, /operationalReportId = report\.id/);
    assert.match(create, /operationalReportId,/);
    assert.match(create, /statusAfterCreatingLinkedAction\(linkedReportStatus\)/);
    assert.doesNotMatch(create, /status:\s*"klar"/);
    assert.doesNotMatch(create, /\.delete\(/);
    assert.doesNotMatch(create, /from\("operational_reports"\)/);
    assert.match(
      read("../../lib/operational-reports/status.ts"),
      /current === "ny" \? "hanteras" : current/,
    );
  });

  it("keeps empty Aktuellt and Att följa upp compact without a large box", () => {
    const page = read("./page.tsx");
    const feed = read("../../components/dashboard/OrgNoticesFeed.tsx");
    const adHoc = read("../../components/daglig-styrning/AdHocActionForm.tsx");
    assert.match(page, /filterDailySteeringNotices/);
    assert.match(page, /<OrgNoticesFeed notices=\{relevantNotices\} compactEmpty/);
    assert.match(page, /Inget att följa upp just nu/);
    assert.match(
      page,
      /followUpActivities\.length === 0 && followUpReports\.length === 0/,
    );
    assert.match(adHoc, /\+ Lägg till åtgärd/);
    const compactAt = feed.indexOf("if (compactEmpty)");
    assert.ok(compactAt >= 0);
    const compactReturn = feed.indexOf("return (", compactAt);
    const nextReturn = feed.indexOf("return (", compactReturn + 1);
    const compactBranch = feed.slice(compactAt, nextReturn);
    assert.match(compactBranch, /Inget aktuellt just nu/);
    assert.doesNotMatch(compactBranch, /InfoPanel/);
    assert.doesNotMatch(compactBranch, /rounded-2xl|border-2|shadow-\[0_10px/);
  });

  it("labels report close as Stäng rapport while activity Klar stays on actions", () => {
    const labels = read("../../types/operational-report.ts");
    const controls = read(
      "../../components/daglig-styrning/ReportStatusControls.tsx",
    );
    const handleButton = read(
      "../../components/daglig-styrning/HandleReportStatusButton.tsx",
    );
    const rowActions = read(
      "../../components/daglig-styrning/ReportRowActions.tsx",
    );
    assert.match(labels, /klar: "Stäng rapport"/);
    assert.match(labels, /\["ny", "hanteras", "klar"\]/);
    assert.match(controls, /OPERATIONAL_REPORT_STATUS_LABELS\[status\]/);
    assert.match(controls, /showStatusBadge = status !== "hanteras"/);
    assert.match(handleButton, /formData.set\("status", "hanteras"\)/);
    assert.match(handleButton, /updateOperationalReportStatusAction/);
    assert.match(controls, /HandleReportStatusButton reportId=\{reportId\}/);
    assert.match(handleButton, /type="button"/);
    assert.doesNotMatch(handleButton, /type="submit"/);
    assert.doesNotMatch(handleButton, /requestSubmit\(\)/);
    assert.match(controls, /showHandle = canUpdate && status === "ny"/);
    assert.doesNotMatch(controls, /\bdisabled\b/);
    assert.doesNotMatch(controls, /aria-disabled/);
    assert.doesNotMatch(controls, /OPERATIONAL_REPORT_STATUSES\.map/);
    assert.doesNotMatch(controls, />Klar</);
    assert.doesNotMatch(controls, /value="ny"/);
    assert.match(rowActions, /name="status" value="klar"/);
    assert.match(rowActions, />\s*Stäng\s*</);
    assert.doesNotMatch(rowActions, /Stäng rapport/);
    assert.match(
      read("../../lib/operational-reports/boardPresentation.ts"),
      /label: "Klar"/,
    );
  });

  it("closing a report cannot mutate a linked activity", () => {
    const action = sliceExport(
      read("./actions.ts"),
      "updateOperationalReportStatusAction",
    );
    assert.match(action, /updateOperationalReportStatus\(/);
    assert.doesNotMatch(action, /patchSteeringActivity/);
    assert.doesNotMatch(action, /createSteeringActivity/);
    assert.doesNotMatch(action, /from\("activities"\)/);
  });

  it("completing an activity cannot mutate the linked report", () => {
    const action = sliceExport(
      read("./actions.ts"),
      "patchSteeringActivityAction",
    );
    assert.match(action, /intent === "status"/);
    assert.match(action, /patchSteeringActivity\(\{\s*id,\s*status\s*\}/);
    assert.doesNotMatch(action, /updateOperationalReportStatus/);
    assert.doesNotMatch(action, /from\("operational_reports"\)/);
  });
});

describe("rapportera page", () => {
  it("is a public form and never uses the service role", () => {
    const page = read("../rapportera/page.tsx");
    const form = read("../../components/rapportera/PublicReportForm.tsx");
    const actions = read("../rapportera/actions.ts");
    assert.match(page, /PublicReportForm/);
    assert.match(form, /submitOperationalReportAction/);
    assert.match(form, /Tack\. Informationen är skickad till Alwex/);
    assert.match(form, /Rapportera en till händelse/);
    assert.match(form, /router\.replace\("\/rapportera"/);
    assert.match(page, /RAPPORTERA TILL ALWEX/);
    assert.match(
      page,
      /Rapportera något som Alwex behöver känna till eller följa upp/,
    );
    assert.doesNotMatch(form, /Vad gäller det\?/);
    assert.doesNotMatch(form, /PUBLIC_REPORT_CATEGORY_OPTIONS/);
    assert.doesNotMatch(form, /name="category"/);
    assert.match(form, /Rapporterat från/);
    assert.doesNotMatch(form, /Åkeri/);
    assert.doesNotMatch(form, /name="haulierName"/);
    assert.match(form, /name="reportingUnitId"/);
    assert.match(form, /Affärsområde/);
    assert.match(form, /Vad har hänt\?/);
    assert.match(form, /Prioritet/);
    assert.match(form, /OPERATIONAL_REPORT_PRIORITY_LABELS\[priority\]/);
    assert.match(
      read("../../types/operational-report.ts"),
      /urgent: "Akut\/allvarligt"/,
    );
    assert.match(form, /Skicka/);
    assert.match(actions, /category: firstParam\(formData\.get\("category"\)\) \|\| "ovrigt"/);
    assert.match(
      form,
      /Vid akut fara eller olycka – kontakta alltid ansvarig på Alwex/,
    );
    assert.doesNotMatch(form, /Akut-allvarligt/);
    assert.doesNotMatch(form, /Kort meddelande till den dagliga styrningen/);
    assert.match(actions, /getPublicOperationalReportAreas/);
    assert.match(actions, /getPublicReportingUnits/);
    assert.match(actions, /reportingUnitId: firstParam\(formData\.get\("reportingUnitId"\)\)/);
    assert.doesNotMatch(actions, /formData\.get\("haulierName"\)/);
    assert.match(actions, /consumeOperationalReportRateLimit/);
    assert.doesNotMatch(actions, /service_role|SERVICE_ROLE/);
    assert.doesNotMatch(page, /AppHeader/);
    assert.doesNotMatch(form, /AppHeader/);
  });
});
