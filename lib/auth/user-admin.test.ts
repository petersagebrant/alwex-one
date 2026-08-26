import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROTECTED_AO_TEST_USER_ID,
  PROTECTED_VD_USER_ID,
  isProtectedUserId,
  protectedUserMutationError,
} from "./protected-users";
import {
  assertActorMayChangeTarget,
  assertActorMaySetPassword,
  parseInviteUserInput,
  parseUpdateUserInput,
} from "./user-admin";

const AREA_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "00000000-0000-4000-8000-0000000000aa";
const OTHER_ID = "00000000-0000-4000-8000-0000000000bb";

describe("invite payload validation", () => {
  it("accepts a named ao_chef with area", () => {
    const parsed = parseInviteUserInput({
      displayName: "  Anna AO  ",
      email: "Anna@Alwex.se",
      role: "ao_chef",
      businessAreaId: AREA_ID,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.displayName, "Anna AO");
    assert.equal(parsed.value.email, "anna@alwex.se");
    assert.equal(parsed.value.role, "ao_chef");
    assert.equal(parsed.value.businessAreaId, AREA_ID);
  });

  it("requires name, email and rejects public-signup-like empty payloads", () => {
    assert.equal(
      parseInviteUserInput({
        displayName: " ",
        email: "anna@alwex.se",
        role: "vd",
        businessAreaId: "",
      }).ok,
      false,
    );
    assert.equal(
      parseInviteUserInput({
        displayName: "Anna",
        email: "not-an-email",
        role: "vd",
        businessAreaId: "",
      }).ok,
      false,
    );
  });

  it("requires area for ao_chef and forbids area on other roles", () => {
    const missingArea = parseInviteUserInput({
      displayName: "Anna",
      email: "anna@alwex.se",
      role: "ao_chef",
      businessAreaId: "",
    });
    assert.equal(missingArea.ok, false);

    const vdWithArea = parseInviteUserInput({
      displayName: "Peter",
      email: "vd@alwex.se",
      role: "vd",
      businessAreaId: AREA_ID,
    });
    assert.equal(vdWithArea.ok, false);

    const admin = parseInviteUserInput({
      displayName: "Admin",
      email: "admin@alwex.se",
      role: "administrator",
      businessAreaId: "",
    });
    assert.equal(admin.ok, true);

    const viceVd = parseInviteUserInput({
      displayName: "Vice VD",
      email: "vice@alwex.se",
      role: "vice_vd",
      businessAreaId: "",
    });
    assert.equal(viceVd.ok, false);
  });

  it("rejects unknown roles including empty", () => {
    const parsed = parseInviteUserInput({
      displayName: "X",
      email: "x@alwex.se",
      role: "superadmin",
      businessAreaId: "",
    });
    assert.equal(parsed.ok, false);
  });
});

describe("self role/area updates", () => {
  it("blocks changing own role or area", () => {
    const role = assertActorMayChangeTarget({
      actorId: ACTOR_ID,
      targetId: ACTOR_ID,
      changingRole: true,
      changingArea: false,
      disabling: false,
    });
    assert.equal(role.ok, false);

    const area = assertActorMayChangeTarget({
      actorId: ACTOR_ID,
      targetId: ACTOR_ID,
      changingRole: false,
      changingArea: true,
      disabling: false,
    });
    assert.equal(area.ok, false);
  });

  it("allows an admin to change another user's role", () => {
    const parsed = parseUpdateUserInput({
      id: OTHER_ID,
      displayName: "Kalle",
      role: "lasbehorighet",
      businessAreaId: "",
    });
    assert.equal(parsed.ok, true);

    const allowed = assertActorMayChangeTarget({
      actorId: ACTOR_ID,
      targetId: OTHER_ID,
      changingRole: true,
      changingArea: false,
      disabling: false,
    });
    assert.equal(allowed.ok, true);
  });
});

describe("protected system UUIDs", () => {
  it("recognizes the hardcoded VD and AO-test accounts", () => {
    assert.equal(isProtectedUserId(PROTECTED_VD_USER_ID), true);
    assert.equal(isProtectedUserId(PROTECTED_AO_TEST_USER_ID), true);
    assert.equal(isProtectedUserId(OTHER_ID), false);
  });

  it("blocks disable and role changes on protected accounts", () => {
    assert.equal(
      protectedUserMutationError(PROTECTED_VD_USER_ID, "disable"),
      "Skyddat systemkonto kan inte inaktiveras.",
    );
    assert.match(
      protectedUserMutationError(PROTECTED_VD_USER_ID, "role") ?? "",
      /VD-kontot/,
    );
    assert.match(
      protectedUserMutationError(PROTECTED_AO_TEST_USER_ID, "role") ?? "",
      /AO-testkontot/,
    );

    const disableVd = assertActorMayChangeTarget({
      actorId: ACTOR_ID,
      targetId: PROTECTED_VD_USER_ID,
      changingRole: false,
      changingArea: false,
      disabling: true,
    });
    assert.equal(disableVd.ok, false);

    const demoteVd = assertActorMayChangeTarget({
      actorId: ACTOR_ID,
      targetId: PROTECTED_VD_USER_ID,
      changingRole: true,
      changingArea: false,
      disabling: false,
    });
    assert.equal(demoteVd.ok, false);

    const demoteAo = assertActorMayChangeTarget({
      actorId: ACTOR_ID,
      targetId: PROTECTED_AO_TEST_USER_ID,
      changingRole: true,
      changingArea: false,
      disabling: false,
    });
    assert.equal(demoteAo.ok, false);
  });
});

describe("assertActorMaySetPassword", () => {
  it("blocks setting your own password", () => {
    const self = assertActorMaySetPassword({
      actorId: ACTOR_ID,
      targetId: ACTOR_ID,
    });
    assert.equal(self.ok, false);
  });

  it("allows VD to set another user's password, including protected accounts", () => {
    const other = assertActorMaySetPassword({
      actorId: ACTOR_ID,
      targetId: OTHER_ID,
    });
    assert.equal(other.ok, true);

    const protectedVd = assertActorMaySetPassword({
      actorId: ACTOR_ID,
      targetId: PROTECTED_VD_USER_ID,
    });
    assert.equal(protectedVd.ok, true);
  });
});
