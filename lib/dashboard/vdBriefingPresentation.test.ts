import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isVdBriefingSectionCollapsedOnMobile } from "./vdBriefingPresentation";

describe("isVdBriefingSectionCollapsedOnMobile", () => {
  it("keeps attention open and collapses the compact side sections", () => {
    assert.equal(isVdBriefingSectionCollapsedOnMobile("attention"), false);
    assert.equal(isVdBriefingSectionCollapsedOnMobile("risks"), true);
    assert.equal(
      isVdBriefingSectionCollapsedOnMobile("recommendations"),
      true,
    );
    assert.equal(isVdBriefingSectionCollapsedOnMobile("positive"), true);
  });
});
