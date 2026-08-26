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

  it("gates Ange nytt lösenord with requireCanSetUserPassword, not administrator", () => {
    const actions = read("app/admin/users/actions.ts");
    const fn = actions.match(
      /export async function setUserPasswordAction[\s\S]*?^}/m,
    );
    assert.ok(fn, "missing setUserPasswordAction");
    assert.match(fn[0]!, /requireCanSetUserPassword\(\)/);
    assert.doesNotMatch(fn[0]!, /requireUserAdministrator\(\)/);
    assert.match(fn[0]!, /setUserTemporaryPassword\(/);
    assert.doesNotMatch(fn[0]!, /redirect\(/);
  });

  it("keeps generateLink and forgot-password resetPasswordForEmail", () => {
    const users = read("services/users.ts");
    const forgot = read("app/auth/forgot-password/actions.ts");
    assert.match(users, /generateLink/);
    assert.match(forgot, /resetPasswordForEmail/);
  });

  it("calls updateUserById with password only and never audits the secret", () => {
    const users = read("services/users.ts");
    const start = users.indexOf("export async function setUserTemporaryPassword");
    assert.ok(start >= 0);
    const body = users.slice(start, users.indexOf("async function requireExistingProfile"));
    assert.match(
      body,
      /updateUserById\(\s*userId,\s*\{\s*password,\s*\}\s*\)/,
    );
    assert.doesNotMatch(body, /ban_duration/);
    assert.doesNotMatch(body, /deleteUser/);
    assert.doesNotMatch(body, /inviteUserByEmail/);
    assert.doesNotMatch(body, /updateProfileRow/);
    assert.doesNotMatch(body, /setProfileDisabledAt/);
    assert.doesNotMatch(body, /console\./);
    assert.match(body, /Administrativ lösenordsåterställning/);

    const auditStart = body.indexOf("recordAuditLog(");
    assert.ok(auditStart >= 0);
    const auditCall = body.slice(auditStart, body.indexOf("});", auditStart) + 3);
    assert.doesNotMatch(auditCall, /\bpassword\b/);
  });

  it("hides the password button from non-VD and never puts the secret in the URL", () => {
    const page = read("app/admin/users/page.tsx");
    assert.match(page, /canSetUserPassword\(actor\.role\)/);
    assert.match(page, /SetUserPasswordControls/);
    assert.doesNotMatch(page, /password=/);

    const ui = read("components/admin/SetUserPasswordControls.tsx");
    assert.match(ui, /Ange nytt lösenord/);
    assert.doesNotMatch(ui, /createServiceRoleClient/);
    assert.doesNotMatch(ui, /SUPABASE_SERVICE_ROLE_KEY/);
  });
});
