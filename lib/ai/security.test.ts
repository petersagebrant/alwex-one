import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AiAccessError,
  assertAreaIdsInAiScope,
  assertRowsInAiScope,
  resolveAiPrincipal,
} from "./security";

const user = { id: "user-1", email: "vd@example.test" };

describe("AI principal and scope", () => {
  it("allows VD with organization scope", () => {
    const principal = resolveAiPrincipal(user, {
      id: user.id,
      role: "vd",
      businessAreaId: null,
    });
    assert.equal(principal.scope, "organization");
  });

  it("allows AO only for the profile business area", () => {
    const principal = resolveAiPrincipal(user, {
      id: user.id,
      role: "ao_chef",
      businessAreaId: "area-a",
    });
    assert.equal(principal.businessAreaId, "area-a");
    assert.doesNotThrow(() =>
      assertRowsInAiScope(
        principal,
        [{ businessAreaId: "area-a" }],
        "test",
      ),
    );
  });

  it("rejects AO rows for any other name, slug or UUID-derived area", () => {
    const principal = resolveAiPrincipal(user, {
      id: user.id,
      role: "ao_chef",
      businessAreaId: "area-a",
    });
    for (const manipulated of [
      "area-b",
      "lager-logistik",
      "00000000-0000-0000-0000-000000000002",
    ]) {
      assert.throws(
        () =>
          assertRowsInAiScope(
            principal,
            [{ businessAreaId: manipulated }],
            "test",
          ),
        AiAccessError,
      );
    }
    assert.throws(
      () => assertAreaIdsInAiScope(principal, ["area-a", null], "audit"),
      AiAccessError,
    );
  });

  it("rejects unauthorized, missing and inconsistent identities", () => {
    const denied = [
      null,
      { id: user.id, role: "administrator" as const, businessAreaId: null },
      { id: user.id, role: "lasbehorighet" as const, businessAreaId: null },
      { id: user.id, role: "ao_chef" as const, businessAreaId: null },
      { id: "other-user", role: "vd" as const, businessAreaId: null },
    ];
    for (const profile of denied) {
      assert.throws(() => resolveAiPrincipal(user, profile), AiAccessError);
    }
    assert.throws(() => resolveAiPrincipal(null, null), AiAccessError);
  });
});
