import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areaNoticesHref,
  newAreaNoticeHref,
  newOrgNoticeHref,
  noticeItemHref,
  noticeSeeAllHref,
} from "./dashboardLinks";

const OWN_SLUG = "own-area";
const OTHER_SLUG = "other-area";

describe("notice dashboard links", () => {
  it("builds own-area Aktuellt and Nytt inlägg from generic area slug", () => {
    assert.equal(areaNoticesHref(OWN_SLUG), `/areas/${OWN_SLUG}`);
    assert.equal(
      newAreaNoticeHref(OWN_SLUG),
      `/areas/${OWN_SLUG}?notice=new`,
    );
  });

  it("builds kyl-frys hrefs for simulated AO-chef", () => {
    assert.equal(areaNoticesHref("kyl-frys"), "/areas/kyl-frys");
    assert.equal(
      newAreaNoticeHref("kyl-frys"),
      "/areas/kyl-frys?notice=new",
    );
    assert.equal(noticeSeeAllHref("kyl-frys", "kyl-frys"), "/areas/kyl-frys");
    assert.equal(noticeSeeAllHref("mark", "kyl-frys"), null);
  });

  it("shows Se alla for own AO and hides it for other areas", () => {
    assert.equal(
      noticeSeeAllHref(OWN_SLUG, OWN_SLUG),
      `/areas/${OWN_SLUG}`,
    );
    assert.equal(noticeSeeAllHref(OTHER_SLUG, OWN_SLUG), null);
    assert.equal(noticeSeeAllHref(null, OWN_SLUG), null);
  });

  it("keeps per-notice Se alla when no own slug (VD/admin)", () => {
    assert.equal(noticeSeeAllHref(OTHER_SLUG), `/areas/${OTHER_SLUG}`);
    assert.equal(noticeSeeAllHref(null), "/areas");
  });

  it("sends VD/admin Nytt inlägg to existing admin form with area picker", () => {
    assert.equal(newOrgNoticeHref(), "/admin/aktuellt?new=1");
    assert.doesNotMatch(newOrgNoticeHref(), /notice=new/);
  });

  it("links VD notice items to the area page, not other-AO for AO-chef", () => {
    assert.equal(noticeItemHref(OTHER_SLUG), `/areas/${OTHER_SLUG}`);
    assert.equal(noticeItemHref(OWN_SLUG, OWN_SLUG), `/areas/${OWN_SLUG}`);
    assert.equal(noticeItemHref(OTHER_SLUG, OWN_SLUG), null);
    assert.equal(noticeItemHref(null), null);
    assert.equal(noticeItemHref(null, OWN_SLUG), null);
  });
});
