import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("user admin server actions", () => {
  it("authorizes inside every exported action", () => {
    const actions = read("app/admin/users/actions.ts");
    assert.match(actions, /^"use server";/m);

    const exported = [
      "inviteUserAction",
      "updateUserAction",
      "setUserDisabledAction",
      "sendUserAccessLinkAction",
    ];

    for (const name of exported) {
      const fn = actions.match(
        new RegExp(`export async function ${name}[\\s\\S]*?^}`, "m"),
      );
      assert.ok(fn, `missing action ${name}`);
      const requireIndex = fn[0]!.indexOf("requireUserAdministrator()");
      assert.ok(requireIndex >= 0, `${name} lacks requireUserAdministrator()`);
      const mutateIndex = Math.min(
        ...["inviteUser(", "updateUser(", "setUserDisabled(", "sendUserAccessLink("]
          .map((token) => fn[0]!.indexOf(token))
          .filter((index) => index >= 0),
      );
      assert.ok(mutateIndex > requireIndex, `${name} authorizes after mutation`);
    }
  });

  it("does not create hosted Auth users from tests or client UI", () => {
    const tests = read("lib/auth/user-admin.test.ts");
    assert.doesNotMatch(tests, /inviteUserByEmail/);
    assert.doesNotMatch(tests, /createServiceRoleClient/);

    const page = read("app/admin/users/page.tsx");
    assert.match(page, /requireUserAdministrator\(\)/);
    assert.doesNotMatch(page, /createServiceRoleClient/);
    assert.doesNotMatch(page, /inviteUserByEmail/);
  });

  it("disables local public signup in config.toml", () => {
    const config = read("supabase/config.toml");
    assert.match(
      config,
      /# Allow\/disallow new user signups to your project\.\nenable_signup = false/,
    );
    assert.match(
      config,
      /# Allow\/disallow new user signups via email to your project\.\nenable_signup = false/,
    );
  });
});
