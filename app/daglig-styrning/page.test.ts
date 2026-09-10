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
    assert.match(page, /Säkerhet/);
    assert.match(page, /Drift idag/);
    assert.match(page, /KPI som kräver uppmärksamhet/);
    assert.match(page, /Inkommet från verksamheten/);
    assert.match(page, /Öppna åtgärder/);
    assert.match(page, /Eskalerat \/ kräver beslut/);
    assert.match(page, /draftDailySteeringSummary/);
    assert.match(page, /fetchActiveProfilesForAssignment/);
    assert.match(page, /toGoalOwnerOptions/);
    assert.doesNotMatch(page, /chart|Chart|recharts/i);
    assert.doesNotMatch(page, /service_role|SERVICE_ROLE/);
    assert.doesNotMatch(actions, /createDecision|insertDecision/);
    const safetyAt = page.indexOf("Säkerhet");
    const driftAt = page.indexOf("Drift idag");
    const kpiAt = page.indexOf("KPI som kräver uppmärksamhet");
    const incomingAt = page.indexOf("Inkommet från verksamheten");
    const actionsAt = page.indexOf("Öppna åtgärder");
    const escalationAt = page.indexOf("Eskalerat / kräver beslut");
    assert.ok(safetyAt > 0 && safetyAt < driftAt);
    assert.ok(driftAt < kpiAt && kpiAt < incomingAt);
    assert.ok(incomingAt < actionsAt && actionsAt < escalationAt);
  });

  it("keeps KPI and report rows compact until Skapa åtgärd or Eskalera", () => {
    const page = read("./page.tsx");
    const actions = read("./actions.ts");
    const linked = read("../../components/daglig-styrning/CreateLinkedActionControls.tsx");
    const adHoc = read("../../components/daglig-styrning/AdHocActionForm.tsx");
    const ownerSelect = read("../../components/daglig-styrning/OwnerSelect.tsx");
    const activityControls = read(
      "../../components/daglig-styrning/ActivityRowControls.tsx",
    );
    const boardPresentation = read(
      "../../lib/operational-reports/boardPresentation.ts",
    );
    assert.match(page, /kpi\.titleLabel/);
    assert.match(linked, /Skapa åtgärd/);
    assert.match(linked, /Eskalera/);
    assert.match(linked, /Vad behöver du hjälp\/beslut med\?/);
    assert.match(linked, /OwnerSelect/);
    assert.match(linked, /Klart senast/);
    assert.match(ownerSelect, /name = "ownerId"/);
    assert.doesNotMatch(linked, /placeholder="Ansvarig"/);
    assert.doesNotMatch(linked, /Kräver beslut/);
    assert.match(adHoc, /\+ Lägg till åtgärd/);
    assert.match(adHoc, /OwnerSelect/);
    assert.match(boardPresentation, /label: "Öppen"/);
    assert.match(boardPresentation, /label: "Pågår"/);
    assert.match(boardPresentation, /label: "Klar"/);
    assert.match(activityControls, /STEERING_BOARD_STATUS_ACTIONS/);
    assert.match(activityControls, /Eskalera/);
    assert.match(activityControls, /Besvarad/);
    assert.match(activityControls, /end-escalation/);
    assert.doesNotMatch(activityControls, /name="owner"/);
    assert.match(actions, /ownerId/);
    assert.match(actions, /statusAfterCreatingLinkedAction/);
    assert.match(actions, /nextStatus !== linkedReportStatus/);
    assert.match(actions, /intent === "end-escalation"/);
    assert.match(actions, /requiresEscalation: false/);
    assert.doesNotMatch(
      actions,
      /intent === "end-escalation"[\s\S]*status: "Klar"/,
    );
    assert.doesNotMatch(actions, /formData\.get\("owner"\)/);
    assert.match(page, /countSafetyIncidentsForDay\(reports\.active/);
  });

  it("labels report close as Stäng rapport while activity Klar stays on actions", () => {
    const labels = read("../../types/operational-report.ts");
    const controls = read(
      "../../components/daglig-styrning/ReportStatusControls.tsx",
    );
    assert.match(labels, /klar: "Stäng rapport"/);
    assert.match(labels, /\["ny", "hanteras", "klar"\]/);
    assert.match(controls, /OPERATIONAL_REPORT_STATUS_LABELS\[next\]/);
    assert.match(controls, /name="status" value=\{next\}/);
    assert.doesNotMatch(controls, />Klar</);
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
    assert.match(
      page,
      /Rapportera något som Alwex behöver känna till eller följa upp/,
    );
    assert.match(form, /Vad gäller det\?/);
    assert.match(form, /PUBLIC_REPORT_CATEGORY_OPTIONS/);
    assert.match(
      form,
      /Vid akut fara eller olycka – kontakta alltid ansvarig på Alwex/,
    );
    assert.doesNotMatch(form, /Akut-allvarligt/);
    assert.doesNotMatch(form, /Kort meddelande till den dagliga styrningen/);
    assert.match(actions, /getPublicOperationalReportAreas/);
    assert.match(actions, /consumeOperationalReportRateLimit/);
    assert.doesNotMatch(actions, /service_role|SERVICE_ROLE/);
    assert.doesNotMatch(page, /AppHeader/);
    assert.doesNotMatch(form, /AppHeader/);
  });
});
