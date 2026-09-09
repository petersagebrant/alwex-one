import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { isVdEquivalent } from "../auth/roles";
import {
  canWriteAreaNoticesForArea,
  canWriteOrganizationWideNotices,
} from "./permissions";
import {
  ORGANIZATION_WIDE_AREA_VALUE,
  ORGANIZATION_WIDE_NOTICE_LABEL,
  areaNoticeAreaLabel,
  areaNoticeMatchesAreaFeed,
  areaNoticeReaderOrFilter,
  isOrganizationWideAreaValue,
  isOrganizationWideNotice,
} from "./organizationWide";
import { parseAreaNoticeFormValues } from "./validateNoticeForm";

const AREA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const orgWideSql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260909120000_area_notices_organization_wide.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const originalSql = readFileSync(
  fileURLToPath(
    new URL("../../supabase/migrations/20260825140000_area_notices.sql", import.meta.url),
  ),
  "utf8",
);
const normalized = orgWideSql.replace(/\s+/g, " ").toLowerCase();

function read(relativeFromLibNotices: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeFromLibNotices, import.meta.url)),
    "utf8",
  );
}

describe("org-wide area_notices migration", () => {
  it("makes business_area_id nullable without updating existing rows", () => {
    assert.match(
      normalized,
      /alter table public\.area_notices alter column business_area_id drop not null/,
    );
    assert.match(originalSql, /business_area_id uuid not null/);
    assert.doesNotMatch(normalized, /update public\.area_notices/);
    assert.doesNotMatch(normalized, /delete from public\.area_notices/);
    assert.doesNotMatch(normalized, /alwex-totalt/);
  });

  it("lets only is_vd_equivalent insert and update org-wide (null) notices", () => {
    assert.match(normalized, /when business_area_id is null then public\.is_vd_equivalent\(\)/);
    assert.match(
      normalized,
      /else public\.can_write_operational\(business_area_id\)/,
    );
    assert.match(orgWideSql, /public.is_vd_equivalent\(\)/);
    assert.doesNotMatch(orgWideSql.toLowerCase(), /sunesson/);
    assert.doesNotMatch(orgWideSql, /has_app_role\(array\['administrator'/);
    assert.doesNotMatch(
      normalized,
      /drop policy if exists "role: read area_notices"/,
    );
  });

  it("keeps authenticated SELECT using true so ao_chef and lasbehorighet see org-wide", () => {
    const original = originalSql.replace(/\s+/g, " ").toLowerCase();
    assert.match(
      original,
      /create policy "role: read area_notices" on public\.area_notices for select to authenticated using \(true\)/,
    );
    assert.doesNotMatch(
      normalized,
      /drop policy if exists "role: read area_notices"/,
    );
  });

  it("keeps area-scoped write on can_write_operational and archive guard for vd-equivalent", () => {
    assert.match(normalized, /can_write_operational\(/);
    assert.match(normalized, /if not public\.is_vd_equivalent\(\)/);
    assert.match(normalized, /prevent_unauthorized_area_notice_archive/);
  });
});

describe("org-wide notice write permissions", () => {
  it("lets vd and vice_vd insert org-wide; ao_chef, admin and lasbehorighet cannot", () => {
    assert.equal(canWriteOrganizationWideNotices("vd"), true);
    assert.equal(canWriteOrganizationWideNotices("vice_vd"), true);
    assert.equal(canWriteOrganizationWideNotices("administrator"), false);
    assert.equal(canWriteOrganizationWideNotices("ao_chef"), false);
    assert.equal(canWriteOrganizationWideNotices("lasbehorighet"), false);

    assert.equal(canWriteAreaNoticesForArea("vd", null, null), true);
    assert.equal(canWriteAreaNoticesForArea("vice_vd", null, null), true);
    assert.equal(canWriteAreaNoticesForArea("administrator", null, null), false);
    assert.equal(canWriteAreaNoticesForArea("ao_chef", AREA_A, null), false);
    assert.equal(canWriteAreaNoticesForArea("lasbehorighet", null, null), false);

    assert.equal(isVdEquivalent("vd"), true);
    assert.equal(isVdEquivalent("vice_vd"), true);
    assert.equal(isVdEquivalent("administrator"), false);
  });

  it("still lets ao_chef write own area and admin write any area", () => {
    assert.equal(canWriteAreaNoticesForArea("ao_chef", AREA_A, AREA_A), true);
    assert.equal(canWriteAreaNoticesForArea("administrator", null, AREA_A), true);
  });
});

describe("org-wide notice labels and reader filter", () => {
  it("labels null area as Hela organisationen", () => {
    assert.equal(ORGANIZATION_WIDE_NOTICE_LABEL, "Hela organisationen");
    assert.equal(areaNoticeAreaLabel(null), "Hela organisationen");
    assert.equal(areaNoticeAreaLabel(""), "Hela organisationen");
    assert.equal(areaNoticeAreaLabel(AREA_A, "Kyl/Frys"), "Kyl/Frys");
    assert.equal(areaNoticeAreaLabel(AREA_A, null), "Okänt område");
    assert.equal(isOrganizationWideNotice(null), true);
    assert.equal(isOrganizationWideNotice(AREA_A), false);
    assert.equal(isOrganizationWideAreaValue("org"), true);
    assert.equal(isOrganizationWideAreaValue(ORGANIZATION_WIDE_AREA_VALUE), true);
  });

  it("includes org-wide (IS NULL) plus the area in reader queries", () => {
    assert.equal(
      areaNoticeReaderOrFilter(AREA_A),
      `business_area_id.eq.${AREA_A},business_area_id.is.null`,
    );
    assert.equal(areaNoticeMatchesAreaFeed(null, AREA_A), true);
    assert.equal(areaNoticeMatchesAreaFeed(AREA_A, AREA_A), true);
    assert.equal(
      areaNoticeMatchesAreaFeed("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", AREA_A),
      false,
    );
  });
});

describe("org-wide form parse and UI wiring", () => {
  it("parses org as null businessAreaId and keeps a concrete area", () => {
    const org = parseAreaNoticeFormValues({
      businessAreaId: "org",
      kind: "Information",
      title: "Org",
      body: "Till alla",
      endsOn: "",
    });
    assert.equal(org.ok, true);
    if (!org.ok) return;
    assert.equal(org.value.businessAreaId, null);

    const area = parseAreaNoticeFormValues({
      businessAreaId: AREA_A,
      kind: "Information",
      title: "AO",
      body: "Till området",
      endsOn: "",
    });
    assert.equal(area.ok, true);
    if (!area.ok) return;
    assert.equal(area.value.businessAreaId, AREA_A);
  });

  it("shows Hela organisationen only for isVdEquivalent and includes org-wide in AO feeds", () => {
    const form = read("../../components/admin/AreaNoticeFormFields.tsx");
    const adminPage = read("../../app/admin/aktuellt/page.tsx");
    const fetch = read("../../lib/supabase/area-notices.ts");
    const feed = read("../../components/dashboard/OrgNoticesFeed.tsx");
    const areaList = read("../../components/areas/AreaNoticesList.tsx");
    const areaPage = read("../../app/areas/[slug]/page.tsx");
    const service = read("../../services/areaNotices.ts");

    assert.match(form, /allowOrganizationWide/);
    assert.match(form, /ORGANIZATION_WIDE_NOTICE_LABEL/);
    assert.match(form, /ORGANIZATION_WIDE_AREA_VALUE/);
    assert.match(adminPage, /isVdEquivalent\(profile\.role\)/);
    assert.match(adminPage, /allowOrganizationWide=\{allowOrganizationWide && !lockedAreaId\}/);
    assert.doesNotMatch(adminPage.toLowerCase(), /sunesson/);
    assert.doesNotMatch(form.toLowerCase(), /sunesson/);
    assert.match(fetch, /areaNoticeReaderOrFilter\(businessAreaId\)/);
    assert.match(feed, /OrganizationWideNoticeBadge/);
    assert.match(areaList, /OrganizationWideNoticeBadge/);
    assert.match(areaPage, /getCurrentAreaNoticesByBusinessAreaId\(dbArea\.id\)/);
    assert.doesNotMatch(areaPage, /allowOrganizationWide/);
    assert.match(service, /isOrganizationWideNotice\(notice\.businessAreaId\)/);
    assert.match(service, /ORGANIZATION_WIDE_NOTICE_LABEL/);
  });
});
