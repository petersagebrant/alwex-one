import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPublicAuthPath } from "./proxy";

describe("isPublicAuthPath", () => {
  it("keeps login and auth public", () => {
    assert.equal(isPublicAuthPath("/login"), true);
    assert.equal(isPublicAuthPath("/login/"), true);
    assert.equal(isPublicAuthPath("/auth/callback"), true);
  });

  it("treats /rapportera and thank-you as public", () => {
    assert.equal(isPublicAuthPath("/rapportera"), true);
    assert.equal(isPublicAuthPath("/rapportera/"), true);
    assert.equal(isPublicAuthPath("/rapportera/tack"), true);
  });

  it("does not open LEIR pages", () => {
    assert.equal(isPublicAuthPath("/"), false);
    assert.equal(isPublicAuthPath("/daglig-styrning"), false);
    assert.equal(isPublicAuthPath("/areas"), false);
  });
});
