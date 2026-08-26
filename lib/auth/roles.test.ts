import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_ROLE_LABELS,
  APP_ROLES,
  canAdministerUsers,
  canManageBusinessAreas,
  canSetUserPassword,
  canWriteDecisions,
  canWriteOperational,
  isVdEquivalent,
  roleRequiresBusinessArea,
} from "./roles";

describe("canAdministerUsers", () => {
  it("allows vd, vice_vd and administrator", () => {
    assert.equal(canAdministerUsers("vd"), true);
    assert.equal(canAdministerUsers("vice_vd"), true);
    assert.equal(canAdministerUsers("administrator"), true);
  });

  it("denies ao_chef and lasbehorighet", () => {
    assert.equal(canAdministerUsers("ao_chef"), false);
    assert.equal(canAdministerUsers("lasbehorighet"), false);
  });

  it("lets lasbehorighet read but not write operational data", () => {
    assert.equal(canWriteOperational("lasbehorighet"), false);
    assert.equal(canWriteOperational("vd"), true);
    assert.equal(canWriteOperational("vice_vd"), true);
    assert.equal(canWriteOperational("administrator"), true);
  });

  it("does not widen other write helpers to ao_chef for decisions or areas", () => {
    assert.equal(canWriteDecisions("ao_chef"), false);
    assert.equal(canManageBusinessAreas("ao_chef"), false);
    assert.equal(canWriteOperational("ao_chef"), true);
  });
});

describe("isVdEquivalent", () => {
  it("treats vd and vice_vd as equivalent, and nobody else", () => {
    assert.equal(isVdEquivalent("vd"), true);
    assert.equal(isVdEquivalent("vice_vd"), true);
    assert.equal(isVdEquivalent("administrator"), false);
    assert.equal(isVdEquivalent("ao_chef"), false);
    assert.equal(isVdEquivalent("lasbehorighet"), false);
  });

  it("gives vice_vd the same write and admin permissions as vd", () => {
    assert.equal(canWriteDecisions("vice_vd"), canWriteDecisions("vd"));
    assert.equal(canManageBusinessAreas("vice_vd"), canManageBusinessAreas("vd"));
    assert.equal(canAdministerUsers("vice_vd"), canAdministerUsers("vd"));
    assert.equal(canWriteOperational("vice_vd"), canWriteOperational("vd"));
    assert.equal(canSetUserPassword("vice_vd"), canSetUserPassword("vd"));
  });

  it("labels vice_vd as Vice VD in the role catalog", () => {
    assert.ok(APP_ROLES.includes("vice_vd"));
    assert.equal(APP_ROLE_LABELS.vice_vd, "Vice VD");
  });

  it("requires a business area only for ao_chef", () => {
    assert.equal(roleRequiresBusinessArea("ao_chef"), true);
    assert.equal(roleRequiresBusinessArea("vd"), false);
    assert.equal(roleRequiresBusinessArea("vice_vd"), false);
    assert.equal(roleRequiresBusinessArea("administrator"), false);
    assert.equal(roleRequiresBusinessArea("lasbehorighet"), false);
  });
});

describe("canSetUserPassword", () => {
  it("allows only vd and vice_vd", () => {
    assert.equal(canSetUserPassword("vd"), true);
    assert.equal(canSetUserPassword("vice_vd"), true);
    assert.equal(canSetUserPassword("administrator"), false);
    assert.equal(canSetUserPassword("ao_chef"), false);
    assert.equal(canSetUserPassword("lasbehorighet"), false);
  });

  it("is narrower than canAdministerUsers so administrator can invite but not set passwords", () => {
    assert.equal(canAdministerUsers("administrator"), true);
    assert.equal(canSetUserPassword("administrator"), false);
    assert.equal(canSetUserPassword("vd"), canAdministerUsers("vd"));
  });
});
