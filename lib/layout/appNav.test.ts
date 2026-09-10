import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_NAV_ITEMS,
  isAppNavItemVisible,
  isMobileMoreNavActive,
  splitMobileAppNav,
  visibleAppNavItems,
} from "./appNav";

describe("visibleAppNavItems", () => {
  it("keeps core links for every role and gates Användare plus AI-assistent", () => {
    const vd = visibleAppNavItems({ role: "vd", business_area_id: null });
    assert.deepEqual(
      vd.map((item) => item.key),
      [
        "home",
        "areas",
        "goals",
        "activities",
        "decisions",
        "kpis",
        "users",
        "assistant",
      ],
    );
    assert.equal(
      vd.find((item) => item.key === "kpis")?.href,
      "/report/kpis",
    );
    assert.equal(vd.find((item) => item.key === "decisions")?.label, "Beslut");

    const ao = visibleAppNavItems({
      role: "ao_chef",
      business_area_id: "area-1",
    });
    assert.equal(
      ao.some((item) => item.key === "users"),
      false,
    );
    assert.equal(
      ao.some((item) => item.key === "assistant"),
      true,
    );

    const aoNoArea = visibleAppNavItems({
      role: "ao_chef",
      business_area_id: null,
    });
    assert.equal(
      aoNoArea.some((item) => item.key === "assistant"),
      false,
    );

    const reader = visibleAppNavItems({
      role: "lasbehorighet",
      business_area_id: null,
    });
    assert.deepEqual(
      reader.map((item) => item.key),
      ["home", "areas", "goals", "activities", "decisions", "kpis"],
    );
  });

  it("does not invent extra permission rules beyond Användare and AI-assistent", () => {
    for (const item of APP_NAV_ITEMS) {
      if (item.key === "users" || item.key === "assistant") {
        continue;
      }
      assert.equal(isAppNavItemVisible(item, null), true);
    }
  });
});

describe("splitMobileAppNav", () => {
  it("puts Dashboard, Affärsområden and KPI on the bar and the rest in Mer", () => {
    const { tabs, more } = splitMobileAppNav(
      visibleAppNavItems({ role: "vd", business_area_id: null }),
    );
    assert.deepEqual(
      tabs.map((item) => item.label),
      ["Dashboard", "Affärsområden", "KPI"],
    );
    assert.deepEqual(
      more.map((item) => item.label),
      ["Mål", "Aktiviteter", "Beslut", "Användare", "AI-assistent"],
    );
    assert.equal(isMobileMoreNavActive("goals", more), true);
    assert.equal(isMobileMoreNavActive("home", more), false);
  });
});
