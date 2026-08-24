import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canWriteGoals, canWriteGoalsForArea } from "./permissions";

const AREA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AREA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("canWriteGoals", () => {
  it("allows vd, administrator and ao_chef", () => {
    assert.equal(canWriteGoals("vd"), true);
    assert.equal(canWriteGoals("administrator"), true);
    assert.equal(canWriteGoals("ao_chef"), true);
  });

  it("hides create/edit/archive for lasbehorighet", () => {
    assert.equal(canWriteGoals("lasbehorighet"), false);
  });
});

describe("canWriteGoalsForArea", () => {
  it("lets vd and administrator write every area", () => {
    assert.equal(canWriteGoalsForArea("vd", null, AREA_A), true);
    assert.equal(canWriteGoalsForArea("administrator", AREA_B, AREA_A), true);
  });

  it("lets ao_chef write only own area, including archive", () => {
    assert.equal(canWriteGoalsForArea("ao_chef", AREA_A, AREA_A), true);
    assert.equal(canWriteGoalsForArea("ao_chef", AREA_A, AREA_B), false);
    assert.equal(canWriteGoalsForArea("ao_chef", null, AREA_A), false);
  });

  it("denies lasbehorighet even for a matching area", () => {
    assert.equal(canWriteGoalsForArea("lasbehorighet", AREA_A, AREA_A), false);
  });
});
