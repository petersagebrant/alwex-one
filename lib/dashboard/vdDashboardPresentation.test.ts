import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

function read(relativeFromLibDashboard: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeFromLibDashboard, import.meta.url)),
    "utf8",
  );
}

describe("VD dashboard presentation", () => {
  const page = read("../../app/page.tsx");
  const vdDash = read("../../components/dashboard/VdLeadershipDashboard.tsx");
  const aoChef = read("../../components/dashboard/AoChefDashboard.tsx");
  const briefingPanel = read("../../components/dashboard/VdBriefingPanel.tsx");
  const briefing = read("../../components/dashboard/VdBriefing.tsx");
  const globalsCss = read("../../app/globals.css");
  const kpisService = read("../../services/kpis.ts");
  const areaPage = read("../../app/areas/[slug]/page.tsx");
  const kpiPage = read("../../app/kpis/[id]/page.tsx");
  const kpiOverview = read("../../services/kpiOverview.ts");
  const dashboardService = read("../../services/dashboard.ts");
  const kpiKind = read("../../lib/kpi/kind.ts");

  it("isolates compact VD layout from AO-chef and keeps briefing then Aktuellt", () => {
    assert.match(page, /if \(vdPrincipal\) \{/);
    assert.match(page, /<VdLeadershipDashboard/);
    assert.match(page, /<AoChefDashboard data=\{aoData\} notices=\{orgNotices\}/);
    assert.doesNotMatch(vdDash, /AoChefDashboard/);

    const briefingIdx = vdDash.indexOf("<VdBriefingPanel");
    const orgFeedIdx = vdDash.indexOf("<OrgNoticesFeed");
    const areaIdx = vdDash.indexOf("<VdAreaOverview");
    assert.ok(briefingIdx >= 0);
    assert.ok(orgFeedIdx > briefingIdx);
    assert.ok(areaIdx > orgFeedIdx);
  });

  it("hides large KPI overview, yesterday block, empty activity/decision buckets, and Historik on VD dashboard only", () => {
    assert.doesNotMatch(vdDash, /KpiOverviewSection/);
    assert.doesNotMatch(vdDash, /exceptionDriven/);
    assert.doesNotMatch(vdDash, /Förändrat sedan föregående period/);
    assert.doesNotMatch(vdDash, /VdDiaryTimeline/);
    assert.doesNotMatch(vdDash, /title="Historik"/);
    assert.doesNotMatch(vdDash, /Inga försenade aktiviteter just nu/);
    assert.doesNotMatch(vdDash, /Inga beslutspunkter registrerade ännu/);
    assert.match(vdDash, /hasActionExceptions/);
    assert.match(vdDash, /delayed.length > 0/);

    assert.match(page, /<KpiOverviewSection data=\{kpiOverview\} exceptionDriven \/>/);
    assert.match(page, /title="Förändrat sedan föregående period"/);
    assert.match(page, /<VdDiaryTimeline events=\{historyEvents\} \/>/);

    assert.match(aoChef, /VdDiaryTimeline/);
    assert.match(aoChef, /yesterdayChanges/);
    assert.match(aoChef, /Mina KPI:er idag/);
  });

  it("filters Kräver åtgärd goals to red, overdue, and due-soon, caps at 5, and stays compact when empty", () => {
    assert.match(vdDash, /selectVdDashboardActionGoals/);
    assert.match(vdDash, /Visa alla mål →/);
    assert.match(vdDash, /VD_GOALS_VIEW_HREF/);
    assert.match(vdDash, /VD_ACTION_GOALS_EMPTY_MESSAGE/);
    assert.doesNotMatch(vdDash, /Inga försenade aktiviteter just nu/);
    assert.match(page, /actionGoals=\{vdActionGoals\}/);
    assert.match(dashboardService, /vdActionGoals/);
    assert.match(dashboardService, /\.filter\(isGoalNeedingAction\)/);
    assert.doesNotMatch(aoChef, /selectVdDashboardActionGoals/);
    assert.doesNotMatch(aoChef, /Visa alla mål/);
    assert.doesNotMatch(aoChef, /vdActionGoals/);
    assert.doesNotMatch(vdDash, /\.delete\(/);
    assert.doesNotMatch(vdDash, /updateGoal/);
  });

  it("renders Rapporteringsläge as a compact status row without changing progress totals", () => {
    assert.match(vdDash, /KPI rapporterade idag/);
    assert.match(vdDash, /återstår/);
    assert.match(vdDash, /orgReporting\.total - orgReporting\.reported/);
    assert.doesNotMatch(vdDash, /title="Rapporteringsläge"/);
    assert.match(kpiKind, /export function isDailyManualReportableKpi/);
    assert.doesNotMatch(aoChef, /Rapporteringsläge/);
  });

  it("still fetches KPI current_value and history for Kyl & Frys / Lager area pages", () => {
    assert.match(kpisService, /export async function getKPIsByBusinessArea/);
    assert.match(kpisService, /currentValue: row.current_value/);
    assert.match(
      kpisService,
      /return await enrichMonthlyResultPeriods\(rows.map\(mapKpiRow\)\)/,
    );
    assert.match(areaPage, /getKPIsByBusinessArea\(dbArea.id\)/);
    assert.match(areaPage, /enrichKpisForAreaDisplay/);
    assert.match(areaPage, /AreaHistoryList/);
    assert.match(kpiPage, /kpi_history/);
    assert.match(kpiOverview, /getRecentKpiHistoryForKpis/);
    assert.match(kpiOverview, /selectKeyKpis/);
    assert.doesNotMatch(vdDash, /delete from/i);
  });

  it("keeps fetchVdBriefingAction and shows short empty briefing cards", () => {
    assert.match(briefingPanel, /fetchVdBriefingAction/);
    assert.match(briefing, /vd-briefing-split/);
    assert.match(briefing, /Inga risker\./);
    assert.match(briefing, /Inga rekommendationer\./);
    assert.doesNotMatch(briefing, /Inga kritiska avvikelser just nu/);
    assert.doesNotMatch(briefing, /Inga tydliga risker de kommande 14 dagarna/);
    assert.doesNotMatch(briefing, /Inga rekommendationer just nu/);
  });

  it("renders briefing as 65/35 desktop grid with stacked right column", () => {
    assert.match(briefing, /vd-briefing-split/);
    assert.match(briefing, /vd-briefing-split__main/);
    assert.match(briefing, /vd-briefing-split__side/);
    assert.match(briefing, /import "\.\/VdBriefing\.css"/);
    assert.match(briefing, /vd-briefing-card/);
    assert.match(
      briefing,
      /gridTemplateColumns:\s*"minmax\(0, 1\.85fr\) minmax\(0, 1fr\)"/,
    );
    assert.match(briefing, /Positiv utveckling/);
    assert.doesNotMatch(briefing, /md:grid-cols-5/);
    assert.doesNotMatch(briefing, /md:grid-cols-3/);
    assert.doesNotMatch(briefing, /lg:grid-cols-2/);
    assert.doesNotMatch(briefing, /min-\[1024px\]/);
    assert.doesNotMatch(briefing, /min-h-/);
    assert.match(globalsCss, /\.vd-briefing-split\s*\{/);
    assert.match(globalsCss, /@media \(max-width: 639px\)/);
    assert.doesNotMatch(globalsCss, /min-width: 1024px/);
  });

  it("greets with the given name helper, not a role remap in the heading", () => {
    assert.match(briefing, /formatPersonalGreeting/);
    assert.match(briefing, /givenNameFromProfileFields/);
    assert.doesNotMatch(briefing, /formatVdRoleDisplay/);
    assert.match(dashboardService, /givenNameFromProfileFields/);
    assert.match(dashboardService, /display_name/);
    assert.match(vdDash, /givenName=\{greetingName\}/);
    assert.match(page, /greetingName=\{firstName\}/);
    assert.doesNotMatch(briefing, /God morgon Vd/);
    assert.doesNotMatch(briefing, /God morgon VD/);
  });
});
