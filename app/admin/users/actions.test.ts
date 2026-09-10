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
      "createUserAction",
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
        ...["createUser(", "updateUser(", "setUserDisabled(", "sendUserAccessLink("]
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
    assert.doesNotMatch(page, /admin\.auth\.admin\.createUser/);
  });

  it("disables local public signup in config.toml", () => {
    const config = read("supabase/config.toml");
    assert.match(
      config,
      /# Allow\/disallow new user signups to your project\.\nenable_signup = false/,
    );
    assert.match(
      config,
      /Public signup stays off via \[auth\] enable_signup = false/,
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
    assert.match(fn[0]!, /actor\.id === id/);
    assert.match(fn[0]!, /setOwnAccountPassword\(/);
    assert.match(fn[0]!, /setUserTemporaryPassword\(/);
    assert.match(fn[0]!, /signInWithPassword\(/);
    assert.doesNotMatch(fn[0]!, /redirect\(/);
  });

  it("creates users with Auth Admin createUser, not invite email", () => {
    const users = read("services/users.ts");
    const start = users.indexOf("export async function createUser");
    assert.ok(start >= 0);
    const body = users.slice(
      start,
      users.indexOf("async function sendInviteOrRecoveryLink"),
    );
    assert.match(body, /admin\.auth\.admin\.createUser\(/);
    assert.match(body, /email_confirm:\s*true/);
    assert.match(body, /user_metadata/);
    assert.match(body, /display_name:/);
    assert.match(body, /parseInviteUserInput/);
    assert.doesNotMatch(body, /inviteUserByEmail/);
    assert.doesNotMatch(body, /generateLink/);
    assert.doesNotMatch(body, /sendInviteOrRecoveryLink/);

    const actions = read("app/admin/users/actions.ts");
    assert.match(actions, /createUserAction/);
    assert.match(actions, /createUser\(/);
    assert.doesNotMatch(actions, /inviteUserByEmail/);
    assert.doesNotMatch(actions, /inviteUserAction/);
  });

  it("does not render password recovery or invite-email actions", () => {
    const page = read("app/admin/users/page.tsx");
    assert.match(page, /Skapa användare/);
    assert.match(page, /createUserAction/);
    assert.match(page, /Ange tillfälligt lösenord/);
    assert.match(page, /SetUserPasswordControls/);
    assert.doesNotMatch(page, /Bjud in användare/);
    assert.doesNotMatch(page, /Skicka inbjudan/);
    assert.doesNotMatch(page, /Skicka lösenordsåterställning/);
    assert.doesNotMatch(page, /Skicka ny inbjudan/);
    assert.doesNotMatch(page, /sendUserAccessLinkAction/);
    assert.doesNotMatch(page, /e-postlänk/);
    assert.doesNotMatch(page, /inbjudan via e-post/);
  });

  it("keeps generateLink and forgot-password resetPasswordForEmail", () => {
    const users = read("services/users.ts");
    const forgot = read("app/auth/forgot-password/actions.ts");
    assert.match(users, /generateLink/);
    assert.match(forgot, /resetPasswordForEmail/);
  });

  it("calls updateUserById with password and email_confirm: true and never audits the secret", () => {
    const users = read("services/users.ts");
    const start = users.indexOf("export async function setUserTemporaryPassword");
    assert.ok(start >= 0);
    const body = users.slice(
      start,
      users.indexOf("export async function setOwnAccountPassword"),
    );
    assert.match(body, /temporaryPasswordAuthUpdate\(password\)/);
    assert.match(
      body,
      /updateUserById\(\s*userId,\s*temporaryPasswordAuthUpdate\(password\),?\s*\)/,
    );
    const helper = read("lib/auth/temporary-password.ts");
    assert.match(helper, /must_change_password:\s*true/);
    assert.match(helper, /email_confirm:\s*true/);
    assert.doesNotMatch(body, /createUser\(/);
    assert.doesNotMatch(body, /ban_duration/);
    assert.doesNotMatch(body, /deleteUser/);
    assert.doesNotMatch(body, /inviteUserByEmail/);
    assert.doesNotMatch(body, /updateProfileRow/);
    assert.doesNotMatch(body, /setProfileDisabledAt/);
    assert.doesNotMatch(body, /insertProfile/);
    assert.doesNotMatch(body, /console\./);
    assert.match(
      body,
      /Administrativ lösenordsåterställning, e-post bekräftad via admin/,
    );

    const auditStart = body.indexOf("recordAuditLog(");
    assert.ok(auditStart >= 0);
    const auditCall = body.slice(auditStart, body.indexOf("});", auditStart) + 3);
    assert.doesNotMatch(auditCall, /\bpassword\b/);
    assert.match(auditCall, /e-post bekräftad via admin/);
  });

  it("sets own VD password via updateUserById without must_change_password", () => {
    const users = read("services/users.ts");
    const start = users.indexOf("export async function setOwnAccountPassword");
    assert.ok(start >= 0);
    const body = users.slice(
      start,
      users.indexOf("export async function clearMustChangePasswordFlag"),
    );
    assert.match(body, /ownAccountPasswordAuthUpdate\(/);
    assert.match(
      body,
      /updateUserById\(\s*actorId,\s*ownAccountPasswordAuthUpdate\(parsed\.value\),?\s*\)/,
    );
    assert.match(body, /parseOwnAccountPassword/);
    assert.match(body, /assertActorMaySetPassword/);
    assert.match(body, /targetId: actorId/);
    assert.doesNotMatch(body, /temporaryPasswordAuthUpdate/);
    assert.doesNotMatch(body, /must_change_password\s*:/);
    assert.doesNotMatch(body, /generateTemporaryPassword/);
    assert.doesNotMatch(body, /updateProfileRow/);
    assert.doesNotMatch(body, /setProfileDisabledAt/);
    assert.doesNotMatch(body, /insertProfile/);
    assert.doesNotMatch(body, /console\./);

    const helper = read("lib/auth/temporary-password.ts");
    const ownStart = helper.indexOf("export function ownAccountPasswordAuthUpdate");
    assert.ok(ownStart >= 0);
    const ownHelper = helper.slice(ownStart, ownStart + 500);
    assert.match(ownHelper, /email_confirm:\s*true/);
    assert.doesNotMatch(ownHelper, /app_metadata/);
    assert.doesNotMatch(ownHelper, /must_change_password/);

    const auditStart = body.indexOf("recordAuditLog(");
    assert.ok(auditStart >= 0);
    const auditCall = body.slice(auditStart, body.indexOf("});", auditStart) + 3);
    assert.doesNotMatch(auditCall, /\bpassword\b/);
    assert.match(auditCall, /eget konto/);
  });

  it("hides the password button from non-VD and never puts the secret in the URL", () => {
    const page = read("app/admin/users/page.tsx");
    assert.match(page, /canSetUserPassword\(actor\.role\)/);
    assert.match(page, /SetUserPasswordControls/);
    assert.match(page, /isSelf=\{user\.isSelf\}/);
    assert.doesNotMatch(page, /canSetPassword && !user\.isSelf/);
    assert.doesNotMatch(page, /password=/);

    const ui = read("components/admin/SetUserPasswordControls.tsx");
    assert.match(ui, /Ange nytt lösenord/);
    assert.match(ui, /setUserPasswordAction/);
    assert.match(ui, /isSelf/);
    assert.match(ui, /Byt lösenord på ditt konto/);
    assert.match(ui, /inte\s+ett tillfälligt lösenord/);
    assert.match(ui, /E-postadressen markeras som bekräftad/);
    assert.match(ui, /Visas bara en gång/);
    assert.doesNotMatch(ui, /inbjudningsmejlet/);
    assert.doesNotMatch(ui, /createServiceRoleClient/);
    assert.doesNotMatch(ui, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("lists Vice VD in the create-user dropdown and keeps Inget for non-AO-chef", () => {
    const fields = read("components/admin/UserFormFields.tsx");
    assert.match(fields, /APP_ROLES\.map/);
    assert.match(fields, /roleRequiresBusinessArea/);
    assert.match(fields, /setBusinessAreaId\(""\)/);
    assert.match(fields, /Vice VD, VD och övriga roller ska ha Inget/);

    const roles = read("lib/auth/roles.ts");
    assert.match(roles, /"vice_vd"/);
    assert.match(roles, /vice_vd: "Vice VD"/);
  });

  it("keeps disable hidden for self and protected accounts", () => {
    const page = read("app/admin/users/page.tsx");
    assert.match(page, /!user\.isSelf && !user\.protected/);
    assert.match(page, /Inaktivera/);

    const userAdmin = read("lib/auth/user-admin.ts");
    assert.match(
      userAdmin,
      /Du kan inte ändra status på ditt eget konto/,
    );
    assert.doesNotMatch(
      userAdmin,
      /Du kan inte ange nytt lösenord för ditt eget konto/,
    );

    const protectedUsers = read("lib/auth/protected-users.ts");
    assert.match(protectedUsers, /Skyddat systemkonto kan inte inaktiveras/);
    assert.match(protectedUsers, /VD-kontot kan inte nedgraderas/);
  });
});
