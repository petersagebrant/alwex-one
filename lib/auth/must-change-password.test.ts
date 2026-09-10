import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CHANGE_PASSWORD_PATH,
  MUST_CHANGE_PASSWORD_KEY,
  clearMustChangePasswordAuthUpdate,
  isMustChangePasswordAllowedPath,
  mustChangePasswordFromUnknown,
  mustChangePasswordFromUser,
} from "./must-change-password";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("mustChangePasswordFromUnknown", () => {
  it("reads app_metadata.must_change_password and ignores other shapes", () => {
    assert.equal(
      mustChangePasswordFromUnknown({
        app_metadata: { [MUST_CHANGE_PASSWORD_KEY]: true },
      }),
      true,
    );
    assert.equal(
      mustChangePasswordFromUnknown({
        app_metadata: { [MUST_CHANGE_PASSWORD_KEY]: false },
      }),
      false,
    );
    assert.equal(
      mustChangePasswordFromUnknown({
        app_metadata: { provider: "email" },
      }),
      false,
    );
    assert.equal(
      mustChangePasswordFromUnknown({
        user_metadata: { [MUST_CHANGE_PASSWORD_KEY]: true },
      }),
      false,
    );
    assert.equal(mustChangePasswordFromUnknown(null), false);
    assert.equal(
      mustChangePasswordFromUnknown({ [MUST_CHANGE_PASSWORD_KEY]: true }),
      true,
    );
  });
});

describe("mustChangePasswordFromUser", () => {
  it("is true only when app_metadata flag is boolean true", () => {
    assert.equal(
      mustChangePasswordFromUser({
        app_metadata: { [MUST_CHANGE_PASSWORD_KEY]: true },
      }),
      true,
    );
    assert.equal(
      mustChangePasswordFromUser({
        app_metadata: { [MUST_CHANGE_PASSWORD_KEY]: "true" },
      }),
      false,
    );
    assert.equal(mustChangePasswordFromUser(null), false);
    assert.equal(mustChangePasswordFromUser({ app_metadata: {} }), false);
  });
});

describe("isMustChangePasswordAllowedPath", () => {
  it("allows change-password, login, callback — not the rest of LEIR", () => {
    assert.equal(isMustChangePasswordAllowedPath(CHANGE_PASSWORD_PATH), true);
    assert.equal(
      isMustChangePasswordAllowedPath(`${CHANGE_PASSWORD_PATH}/`),
      true,
    );
    assert.equal(isMustChangePasswordAllowedPath("/login"), true);
    assert.equal(isMustChangePasswordAllowedPath("/login/"), true);
    assert.equal(isMustChangePasswordAllowedPath("/auth/callback"), true);
    assert.equal(isMustChangePasswordAllowedPath("/"), false);
    assert.equal(isMustChangePasswordAllowedPath("/areas"), false);
    assert.equal(isMustChangePasswordAllowedPath("/admin/users"), false);
    assert.equal(isMustChangePasswordAllowedPath("/auth/update-password"), false);
    assert.equal(isMustChangePasswordAllowedPath("/auth/forgot-password"), false);
    assert.equal(isMustChangePasswordAllowedPath("/report/kpis"), false);
  });
});

describe("clearMustChangePasswordAuthUpdate", () => {
  it("clears only the flag in app_metadata", () => {
    const update = clearMustChangePasswordAuthUpdate();
    assert.equal(update.app_metadata[MUST_CHANGE_PASSWORD_KEY], false);
    assert.deepEqual(Object.keys(update), ["app_metadata"]);
    assert.deepEqual(Object.keys(update.app_metadata), [
      MUST_CHANGE_PASSWORD_KEY,
    ]);
  });
});

describe("must-change-password wiring", () => {
  it("gates proxy redirects when the flag is true", () => {
    const proxy = read("lib/supabase/proxy.ts");
    assert.match(proxy, /mustChangePasswordFromUnknown/);
    assert.match(proxy, /isMustChangePasswordAllowedPath/);
    assert.match(proxy, /CHANGE_PASSWORD_PATH/);
    assert.match(proxy, /getUser\(\)/);
    assert.doesNotMatch(proxy, /user_metadata/);
  });

  it("gates requireUser and getCurrentUser when the flag is true", () => {
    const requireUser = read("lib/auth/require-user.ts");
    assert.match(requireUser, /mustChangePasswordFromUser/);
    assert.match(requireUser, /CHANGE_PASSWORD_PATH/);
    assert.match(requireUser, /redirect\(CHANGE_PASSWORD_PATH\)/);
  });

  it("clears the flag after a successful user password change", () => {
    const action = read("app/auth/change-password/actions.ts");
    assert.match(action, /updateUser\(\{\s*password\s*\}\)/);
    assert.match(action, /clearMustChangePasswordFlag\(/);
    assert.match(action, /refreshSession\(/);
    assert.match(action, /redirect\("\/"\)/);
    assert.doesNotMatch(action, /createServiceRoleClient/);
    assert.doesNotMatch(action, /recordAuditLog/);
    assert.doesNotMatch(action, /\bpassword\b.*redirect/);

    const users = read("services/users.ts");
    const start = users.indexOf("export async function clearMustChangePasswordFlag");
    assert.ok(start >= 0);
    const body = users.slice(start, start + 700);
    assert.match(body, /clearMustChangePasswordAuthUpdate\(\)/);
    assert.match(
      body,
      /updateUserById\(\s*userId,\s*clearMustChangePasswordAuthUpdate\(\),?\s*\)/,
    );
    assert.doesNotMatch(body, /updateProfileRow/);
    assert.doesNotMatch(body, /role:/);
    assert.doesNotMatch(body, /business_area/);
    assert.doesNotMatch(body, /\bpassword\b/);
  });

  it("links Byt lösenord from header and mobile Mer for signed-in users", () => {
    const header = read("components/layout/AppHeader.tsx");
    const mer = read("components/layout/AppBottomNav.tsx");
    assert.match(header, /Byt lösenord/);
    assert.match(header, /href=\{CHANGE_PASSWORD_PATH\}/);
    assert.match(mer, /Byt lösenord/);
    assert.match(mer, /href=\{CHANGE_PASSWORD_PATH\}/);
  });
});
