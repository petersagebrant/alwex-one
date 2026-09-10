import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  generateTemporaryPassword,
  ownAccountPasswordAuthUpdate,
  temporaryPasswordAuthUpdate,
} from "./temporary-password";
import { MUST_CHANGE_PASSWORD_KEY } from "./must-change-password";

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

describe("temporaryPasswordAuthUpdate", () => {
  it("calls mocked updateUserById with password, email_confirm, and must_change_password", async () => {
    const updateUserById = mock.fn(
      async (
        _uid: string,
        attributes: {
          password: string;
          email_confirm: boolean;
          app_metadata: { must_change_password: boolean };
        },
      ) => {
        return { data: { user: { id: _uid } }, error: null };
      },
    );

    const password = generateTemporaryPassword();
    const { error } = await updateUserById(
      "user-id",
      temporaryPasswordAuthUpdate(password),
    );

    assert.equal(error, null);
    assert.equal(updateUserById.mock.calls.length, 1);
    const [uid, attributes] = updateUserById.mock.calls[0]!.arguments;
    assert.equal(uid, "user-id");
    assert.equal(attributes.password, password);
    assert.equal(attributes.email_confirm, true);
    assert.equal(attributes.app_metadata[MUST_CHANGE_PASSWORD_KEY], true);
    assert.deepEqual(Object.keys(attributes).sort(), [
      "app_metadata",
      "email_confirm",
      "password",
    ]);
    assert.deepEqual(Object.keys(attributes.app_metadata), [
      MUST_CHANGE_PASSWORD_KEY,
    ]);
  });
});

describe("ownAccountPasswordAuthUpdate", () => {
  it("sets password and email_confirm without touching app_metadata", () => {
    const password = generateTemporaryPassword();
    const attributes = ownAccountPasswordAuthUpdate(password);

    assert.equal(attributes.password, password);
    assert.equal(attributes.email_confirm, true);
    assert.deepEqual(Object.keys(attributes).sort(), [
      "email_confirm",
      "password",
    ]);
    assert.equal("app_metadata" in attributes, false);
  });
});
