import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAdministerUsers,
  canManageBusinessAreas,
  canWriteDecisions,
  canWriteOperational,
} from "./roles";

describe("canAdministerUsers", () => {
  it("allows vd and administrator", () => {
    assert.equal(canAdministerUsers("vd"), true);
    assert.equal(canAdministerUsers("administrator"), true);
  });

  it("denies ao_chef and lasbehorighet", () => {
    assert.equal(canAdministerUsers("ao_chef"), false);
    assert.equal(canAdministerUsers("lasbehorighet"), false);
  });

  it("does not widen other write helpers to ao_chef for decisions or areas", () => {
    assert.equal(canWriteDecisions("ao_chef"), false);
    assert.equal(canManageBusinessAreas("ao_chef"), false);
    assert.equal(canWriteOperational("ao_chef"), true);
  });
});
