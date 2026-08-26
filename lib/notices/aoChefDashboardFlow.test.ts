import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { canWriteDecisions } from "../auth/roles";
import {
  areaNoticesHref,
  newAreaNoticeHref,
  newOrgNoticeHref,
  noticeItemHref,
  noticeSeeAllHref,
} from "./dashboardLinks";
import { canWriteAreaNoticesForArea } from "./permissions";

/** Simulated AO-chef assigned to Kyl/Frys — no hosted login. */
const KYL_FRYS = "kyl-frys";
const OTHER_AO = "mark";
const AREA_OWN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AREA_OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function read(relativeFromLibNotices: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeFromLibNotices, import.meta.url)),
    "utf8",
  );
}

describe("AO-chef dashboard flow (kyl-frys simulation)", () => {
  const aoChef = read("../../components/dashboard/AoChefDashboard.tsx");
  const feed = read("../../components/dashboard/OrgNoticesFeed.tsx");
  const page = read("../../app/page.tsx");
  const decisionsPage = read("../../app/admin/decisions/page.tsx");
  const reportKpis = read("../../app/report/kpis/page.tsx");
  const vdView = read("../../components/report/VdKpiReportingView.tsx");
  const requireUser = read("../auth/require-user.ts");
  const areaPage = read("../../app/areas/[slug]/page.tsx");
  const noticeActions = read("../../app/admin/aktuellt/actions.ts");

  it("shows Nytt inlägg on AoChefDashboard", () => {
    assert.match(aoChef, /<OrgNoticesFeed/);
    assert.match(aoChef, /canCreate/);
    assert.match(aoChef, /createHref=\{newAreaNoticeHref\(area\.slug\)\}/);
    assert.match(feed, />\s*Nytt inlägg\s*</);
    assert.match(feed, /canCreate && createHref \? \(/);
  });

  it("sends Nytt inlägg to own area ?notice=new (kyl-frys)", () => {
    assert.equal(
      newAreaNoticeHref(KYL_FRYS),
      `/areas/${KYL_FRYS}?notice=new`,
    );
    assert.match(aoChef, /newAreaNoticeHref\(area\.slug\)/);
    assert.doesNotMatch(aoChef, /\/admin\/aktuellt\?new=1/);
    assert.match(areaPage, /noticeQuery === "new"/);
  });

  it("sends Aktuellt and Se alla to own slug, not other AO", () => {
    assert.equal(areaNoticesHref(KYL_FRYS), `/areas/${KYL_FRYS}`);
    assert.equal(
      noticeSeeAllHref(KYL_FRYS, KYL_FRYS),
      `/areas/${KYL_FRYS}`,
    );
    assert.equal(noticeSeeAllHref(OTHER_AO, KYL_FRYS), null);
    assert.equal(noticeSeeAllHref(null, KYL_FRYS), null);
    assert.match(aoChef, /ownAreaSlug=\{area\.slug\}/);
    assert.match(feed, /titleHref=\{ownAreaSlug \? areaNoticesHref\(ownAreaSlug\)/);
    assert.match(feed, /noticeSeeAllHref\(\s*notice\.businessAreaSlug,\s*ownAreaSlug/);
  });

  it("links KPI reporting to /report/kpis", () => {
    const kpiHrefs = [...aoChef.matchAll(/href="\/report\/kpis"/g)];
    assert.ok(kpiHrefs.length >= 2);
    assert.match(aoChef, /Rapportera KPI/);
  });

  it("hides Nytt beslut when !canWriteDecisions (AO-chef)", () => {
    assert.equal(canWriteDecisions("ao_chef"), false);
    assert.doesNotMatch(aoChef, /Nytt beslut/);
    assert.match(
      decisionsPage,
      /allowDecisionWrite = canWriteDecisions\(profile\.role\)/,
    );
    assert.match(
      decisionsPage,
      /allowDecisionWrite && !showCreate && !showEdit/,
    );
    assert.match(requireUser, /async function requireDecisionWriter/);
    assert.match(requireUser, /canWriteDecisions\(profile\.role\)/);
  });

  it("blocks write against another area via canWriteAreaNoticesForArea", () => {
    assert.equal(
      canWriteAreaNoticesForArea("ao_chef", AREA_OWN, AREA_OWN),
      true,
    );
    assert.equal(
      canWriteAreaNoticesForArea("ao_chef", AREA_OWN, AREA_OTHER),
      false,
    );
    assert.match(areaPage, /canWriteAreaNoticesForArea/);
    assert.match(
      areaPage,
      /showNoticeCreate = canWriteNotice && noticeQuery === "new"/,
    );
    assert.match(noticeActions, /canWriteAreaNoticesForArea/);
    assert.match(
      noticeActions,
      /Du saknar behörighet att skriva Aktuellt för området/,
    );
  });

  it("keeps VD/admin Nytt beslut, org Aktuellt and KPI area picker", () => {
    assert.equal(canWriteDecisions("vd"), true);
    assert.equal(canWriteDecisions("administrator"), true);
    assert.equal(noticeSeeAllHref(KYL_FRYS), `/areas/${KYL_FRYS}`);
    assert.equal(noticeSeeAllHref(OTHER_AO), `/areas/${OTHER_AO}`);
    assert.match(page, /canWriteAreaNotices\(profileRow\.role\)/);
    assert.match(page, /canCreate=\{canCreateOrgNotice\}/);
    assert.match(page, /createHref=\{canCreateOrgNotice \? newOrgNoticeHref\(\)/);
    assert.match(page, /newOrgNoticeHref/);
    assert.doesNotMatch(page, /ownAreaSlug=/);
    assert.doesNotMatch(page, /newAreaNoticeHref/);
    assert.equal(newOrgNoticeHref(), "/admin/aktuellt?new=1");
    assert.equal(noticeItemHref(KYL_FRYS), `/areas/${KYL_FRYS}`);
    assert.equal(noticeItemHref(OTHER_AO, KYL_FRYS), null);
    assert.match(feed, /noticeItemHref/);
    assert.match(decisionsPage, /Nytt beslut/);
    assert.match(reportKpis, /isLeadership/);
    assert.match(reportKpis, /<VdKpiReportingView/);
    assert.match(vdView, /Visa affärsområde/);
    assert.match(vdView, /selectedAreaId/);
    assert.equal(
      canWriteAreaNoticesForArea("vd", null, AREA_OTHER),
      true,
    );
    assert.equal(
      canWriteAreaNoticesForArea("administrator", null, AREA_OWN),
      true,
    );
  });
});
