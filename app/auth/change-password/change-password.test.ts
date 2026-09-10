import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("change-password forced first login", () => {
  it("hides current password and only asks for the new one", () => {
    const form = read("app/auth/change-password/change-password-form.tsx");
    assert.match(form, /requireCurrentPassword \? \(/);
    assert.match(form, /Nytt lösenord/);
    assert.match(form, /Bekräfta nytt lösenord/);
    assert.match(form, /Spara nytt lösenord/);
    assert.doesNotMatch(form, /valfritt/);
    assert.doesNotMatch(form, /required=\{requireCurrentPassword\}/);

    const page = read("app/auth/change-password/page.tsx");
    assert.match(page, /requireCurrentPassword=\{!forced\}/);
    assert.match(page, /Välj ditt lösenord/);
  });

  it("does not re-verify the temp password after the session is already authenticated", () => {
    const action = read("app/auth/change-password/actions.ts");
    const mustChangeIndex = action.indexOf(
      "const mustChange = mustChangePasswordFromUser(user);",
    );
    const voluntaryBlock = action.indexOf("if (!mustChange) {");
    const verifyIndex = action.indexOf("signInWithPassword");
    const updateIndex = action.indexOf("updateUser({ password })");

    assert.ok(mustChangeIndex >= 0);
    assert.ok(voluntaryBlock > mustChangeIndex);
    assert.ok(verifyIndex > voluntaryBlock);
    assert.ok(updateIndex > verifyIndex);
    assert.match(action, /Ange nuvarande lösenord/);
    assert.doesNotMatch(
      action.slice(mustChangeIndex, voluntaryBlock),
      /signInWithPassword/,
    );
  });
});

describe("change-password voluntary Byt lösenord", () => {
  it("still requires current password in the form and the action", () => {
    const form = read("app/auth/change-password/change-password-form.tsx");
    assert.match(form, /htmlFor="currentPassword"/);
    assert.match(form, /Nuvarande lösenord/);
    assert.match(form, /requireCurrentPassword && !currentPassword/);
    assert.match(form, /Ange nuvarande lösenord/);

    const page = read("app/auth/change-password/page.tsx");
    assert.match(page, /Byt lösenord/);
    assert.match(page, /Ange nuvarande lösenord och välj ett nytt/);

    const action = read("app/auth/change-password/actions.ts");
    assert.match(action, /if \(!mustChange\) \{/);
    assert.match(action, /if \(!currentPassword\) \{/);
    assert.match(action, /Nuvarande lösenord stämmer inte/);
  });
});
