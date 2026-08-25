import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseAreaNoticeFormValues } from "./validateNoticeForm";
import {
  canWriteAreaNotices,
  canWriteAreaNoticesForArea,
} from "./permissions";
import { rankDashboardNotices, truncateNoticeBody } from "./rank";
import {
  isArchivedAreaNotice,
  isCurrentAreaNotice,
  isExpiredAreaNotice,
} from "./visibility";
import { AREA_NOTICE_KINDS, DASHBOARD_NOTICE_LIMIT } from "./kind";

const AREA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AREA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260825140000_area_notices.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").toLowerCase();

function read(relativeFromLibNotices: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeFromLibNotices, import.meta.url)),
    "utf8",
  );
}

describe("area_notices migration", () => {
  it("creates the table with kinds, blank checks and archive columns", () => {
    assert.match(normalized, /create table public\.area_notices/);
    for (const kind of AREA_NOTICE_KINDS) {
      assert.match(migration, new RegExp(kind));
    }
    assert.match(normalized, /length\(trim\(title\)\) > 0/);
    assert.match(normalized, /length\(trim\(body\)\) > 0/);
    assert.match(normalized, /ends_on date null/);
    assert.match(normalized, /archived_at timestamptz null/);
    assert.doesNotMatch(normalized, /unique \(.*title/);
    assert.match(
      normalized,
      /create index area_notices_business_area_created_at_idx on public\.area_notices \(business_area_id, created_at desc\)/,
    );
    assert.match(
      normalized,
      /where archived_at is null/,
    );
  });

  it("grants select/insert/update, has no DELETE policy, and archives like goals", () => {
    assert.match(
      normalized,
      /grant select, insert, update on table public\.area_notices to authenticated/,
    );
    assert.doesNotMatch(normalized, /grant delete on table public\.area_notices/);
    assert.doesNotMatch(normalized, /for delete/);
    assert.match(normalized, /prevent_unauthorized_area_notice_archive/);
    assert.match(normalized, /can_write_operational\(/);
    assert.match(normalized, /area_notices_set_updated_at/);
    assert.match(normalized, /prevent_area_notice_on_totalt/);
    assert.match(normalized, /slug = 'alwex-totalt'/);
  });

  it("lets every authenticated user read all notices (not can_read isolation)", () => {
    assert.match(
      normalized,
      /create policy "role: read area_notices" on public\.area_notices for select to authenticated using \(true\)/,
    );
    assert.doesNotMatch(
      normalized,
      /role: read area_notices[\s\S]*can_read_business_area/,
    );
    assert.match(
      normalized,
      /create policy "role: insert area_notices" on public\.area_notices for insert to authenticated with check \(public\.can_write_operational\(business_area_id\)\)/,
    );
    assert.match(
      normalized,
      /using \(public\.can_write_operational\(business_area_id\)\) with check \(public\.can_write_operational\(business_area_id\)\)/,
    );
  });
});

describe("area notice visibility", () => {
  const today = "2026-08-25";

  it("treats null ends_on as current and hides past ends_on", () => {
    assert.equal(
      isCurrentAreaNotice({ archivedAt: null, endsOn: null }, today),
      true,
    );
    assert.equal(
      isCurrentAreaNotice({ archivedAt: null, endsOn: today }, today),
      true,
    );
    assert.equal(
      isCurrentAreaNotice({ archivedAt: null, endsOn: "2026-08-24" }, today),
      false,
    );
    assert.equal(
      isExpiredAreaNotice({ archivedAt: null, endsOn: "2026-08-24" }, today),
      true,
    );
    assert.equal(
      isExpiredAreaNotice({ archivedAt: null, endsOn: null }, today),
      false,
    );
  });

  it("hides archived notices from Aktuellt even with a future ends_on", () => {
    assert.equal(
      isCurrentAreaNotice(
        { archivedAt: "2026-08-20T10:00:00.000Z", endsOn: "2026-12-31" },
        today,
      ),
      false,
    );
    assert.equal(
      isArchivedAreaNotice({ archivedAt: "2026-08-20T10:00:00.000Z" }),
      true,
    );
    assert.equal(
      isExpiredAreaNotice(
        { archivedAt: "2026-08-20T10:00:00.000Z", endsOn: "2026-08-24" },
        today,
      ),
      false,
    );
  });
});

describe("area notice write permissions", () => {
  it("lets all authenticated roles be represented: read is org-wide, write is scoped", () => {
    assert.equal(canWriteAreaNotices("vd"), true);
    assert.equal(canWriteAreaNotices("administrator"), true);
    assert.equal(canWriteAreaNotices("ao_chef"), true);
    assert.equal(canWriteAreaNotices("lasbehorighet"), false);

    assert.equal(canWriteAreaNoticesForArea("vd", null, AREA_A), true);
    assert.equal(
      canWriteAreaNoticesForArea("administrator", null, AREA_B),
      true,
    );
    assert.equal(canWriteAreaNoticesForArea("ao_chef", AREA_A, AREA_A), true);
    assert.equal(canWriteAreaNoticesForArea("ao_chef", AREA_A, AREA_B), false);
    assert.equal(
      canWriteAreaNoticesForArea("lasbehorighet", AREA_A, AREA_A),
      false,
    );
  });
});

describe("dashboard ranking and limit", () => {
  it("orders Driftstörning, Viktigt, Behov, Information and caps at 8", () => {
    const notices = [
      { id: "i1", kind: "Information" as const, createdAt: "2026-08-25T10:00:00Z" },
      { id: "b1", kind: "Behov" as const, createdAt: "2026-08-25T11:00:00Z" },
      { id: "v1", kind: "Viktigt" as const, createdAt: "2026-08-24T09:00:00Z" },
      { id: "d1", kind: "Driftstörning" as const, createdAt: "2026-08-20T08:00:00Z" },
      { id: "d2", kind: "Driftstörning" as const, createdAt: "2026-08-25T12:00:00Z" },
      { id: "v2", kind: "Viktigt" as const, createdAt: "2026-08-25T08:00:00Z" },
      { id: "i2", kind: "Information" as const, createdAt: "2026-08-25T09:00:00Z" },
      { id: "b2", kind: "Behov" as const, createdAt: "2026-08-22T11:00:00Z" },
      { id: "i3", kind: "Information" as const, createdAt: "2026-08-21T09:00:00Z" },
    ];
    const ranked = rankDashboardNotices(notices);
    assert.equal(ranked.length, DASHBOARD_NOTICE_LIMIT);
    assert.deepEqual(
      ranked.map((item) => item.id),
      ["d2", "d1", "v2", "v1", "b1", "b2", "i1", "i2"],
    );
  });

  it("truncates dashboard body around 140 characters", () => {
    const long = "x".repeat(160);
    const truncated = truncateNoticeBody(long);
    assert.equal(truncated.endsWith("…"), true);
    assert.ok(truncated.length <= 141);
    assert.equal(truncateNoticeBody("kort text"), "kort text");
  });
});

describe("parseAreaNoticeFormValues", () => {
  const base = {
    businessAreaId: AREA_A,
    kind: "Information",
    title: "Kort info",
    body: "Beskrivning",
    endsOn: "",
  };

  it("requires area, kind, trimmed title and body", () => {
    assert.equal(parseAreaNoticeFormValues({ ...base, title: "  " }).ok, false);
    assert.equal(parseAreaNoticeFormValues({ ...base, body: " " }).ok, false);
    assert.equal(
      parseAreaNoticeFormValues({ ...base, businessAreaId: "" }).ok,
      false,
    );
    assert.equal(parseAreaNoticeFormValues({ ...base, kind: "Övrigt" }).ok, false);
  });

  it("accepts optional ends_on and enforces title/body max", () => {
    const ok = parseAreaNoticeFormValues({
      ...base,
      endsOn: "2026-09-01",
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.equal(ok.value.endsOn, "2026-09-01");

    assert.equal(
      parseAreaNoticeFormValues({ ...base, title: "a".repeat(81) }).ok,
      false,
    );
    assert.equal(
      parseAreaNoticeFormValues({ ...base, body: "b".repeat(401) }).ok,
      false,
    );
    assert.equal(
      parseAreaNoticeFormValues({ ...base, endsOn: "2026-02-31" }).ok,
      false,
    );
  });
});

describe("aktuellt module wiring", () => {
  it("keeps dashboard org-wide for AO-chef and filters totalt", () => {
    const page = read("../../app/page.tsx");
    const aoChef = read("../../components/dashboard/AoChefDashboard.tsx");
    const areaPage = read("../../app/areas/[slug]/page.tsx");
    const historyFeed = read("../../services/historyFeed.ts");
    const assistant = read("../../services/assistant.ts");

    const feed = read("../../components/dashboard/OrgNoticesFeed.tsx");
    assert.match(page, /getDashboardAreaNotices/);
    assert.match(page, /OrgNoticesFeed/);
    assert.match(aoChef, /OrgNoticesFeed/);
    assert.match(aoChef, /notices/);
    assert.match(feed, /Aktuellt i verksamheten/);
    assert.match(feed, /Se alla/);

    const briefingIdx = page.indexOf("<VdBriefingPanel");
    const attentionIdx = page.indexOf("<VdAttentionList");
    const orgFeedIdx = page.indexOf("<OrgNoticesFeed");
    const reportingIdx = page.indexOf('title="Rapporteringsläge"');
    const kpiOverviewIdx = page.indexOf("<KpiOverviewSection");
    const yesterdayIdx = page.indexOf('title="Förändrat sedan föregående period"');
    const foldIdx = page.indexOf(
      'title="Försenade aktiviteter, öppna beslut och mål"',
    );
    const catalogIdx = page.indexOf('aria-labelledby="areas-heading"');
    const timelineIdx = page.indexOf("<VdDiaryTimeline");
    assert.ok(briefingIdx >= 0 && attentionIdx > briefingIdx);
    assert.ok(orgFeedIdx > attentionIdx);
    assert.ok(reportingIdx > orgFeedIdx);
    assert.ok(kpiOverviewIdx > reportingIdx);
    assert.ok(yesterdayIdx > kpiOverviewIdx);
    assert.ok(foldIdx > yesterdayIdx);
    assert.ok(catalogIdx > foldIdx);
    assert.ok(timelineIdx > catalogIdx);
    assert.match(page, /exceptionDriven/);
    assert.doesNotMatch(page, /Sedan du loggade in/);
    assert.doesNotMatch(page, /Kräver ledningens uppmärksamhet/);
    assert.doesNotMatch(page, /title="Senaste händelser"/);
    assert.doesNotMatch(page, /title="VD-assistent"/);

    const aoFeedIdx = aoChef.indexOf("<OrgNoticesFeed");
    const aoGreetingIdx = aoChef.indexOf("{greeting}");
    const aoKpiIdx = aoChef.indexOf("Mina KPI:er idag");
    assert.ok(aoGreetingIdx >= 0 && aoFeedIdx > aoGreetingIdx);
    assert.ok(aoKpiIdx > aoFeedIdx);
    assert.match(areaPage, /AreaNoticesList/);
    assert.match(areaPage, /noticeQuery === "new"/);
    assert.match(areaPage, /isAlwexTotaltSlug/);
    assert.match(historyFeed, /area_notice/);
    assert.doesNotMatch(assistant, /getDashboardAreaNotices/);
    assert.doesNotMatch(assistant, /area_notices/);
  });
});
