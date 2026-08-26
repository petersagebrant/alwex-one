import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateTemporaryPassword } from "./temporary-password";

describe("generateTemporaryPassword", () => {
  it("returns at least 12 mixed characters", () => {
    const password = generateTemporaryPassword();
    assert.ok(password.length >= 12);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[!@#$%&*?]/);
  });

  it("does not repeat the same value", () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();
    assert.notEqual(first, second);
  });
});
