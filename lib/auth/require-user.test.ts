import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { denyRedirectHref, loginRedirectHref } from "./deny-redirect";

describe("deny redirect", () => {
  it("sends logged-in authorization failures to /?error=, not /login", () => {
    const href = denyRedirectHref(
      "Du saknar behörighet att skapa eller redigera beslut.",
    );
    assert.equal(href.startsWith("/?error="), true);
    assert.doesNotMatch(href, /\/login/);
    assert.ok(href.includes(encodeURIComponent("Du saknar behörighet")));
  });

  it("reserves /login for unauthenticated callers only", () => {
    assert.equal(loginRedirectHref(), "/login");
    assert.equal(
      loginRedirectHref("E-post krävs."),
      `/login?error=${encodeURIComponent("E-post krävs.")}`,
    );
  });

  it("wires deny() to denyRedirectHref in require-user", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/auth/require-user.ts"),
      "utf8",
    );
    const denyStart = source.indexOf("function deny(");
    assert.ok(denyStart >= 0);
    const denyBody = source.slice(denyStart, denyStart + 180);
    assert.match(denyBody, /denyRedirectHref\(message\)/);
    assert.doesNotMatch(denyBody, /\/login/);
    assert.match(source, /redirect\(loginRedirectHref\(\)\)/);
  });

  it("gates beslut writes with canWriteDecisions, not /login", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/auth/require-user.ts"),
      "utf8",
    );
    const fnStart = source.indexOf("async function requireDecisionWriter");
    assert.ok(fnStart >= 0);
    const fnBody = source.slice(fnStart, fnStart + 280);
    assert.match(fnBody, /canWriteDecisions\(profile\.role\)/);
    assert.match(fnBody, /deny\(/);
    assert.doesNotMatch(fnBody, /\/login/);
  });

  it("gates password reset with canSetUserPassword and deny(), not canAdministerUsers", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/auth/require-user.ts"),
      "utf8",
    );
    const fnStart = source.indexOf("async function requireCanSetUserPassword");
    assert.ok(fnStart >= 0);
    const fnBody = source.slice(fnStart, fnStart + 360);
    assert.match(fnBody, /canSetUserPassword\(profile\.role\)/);
    assert.match(fnBody, /deny\(/);
    assert.doesNotMatch(fnBody, /canAdministerUsers/);
    assert.doesNotMatch(fnBody, /\/login/);
  });

  it("shows ?error= on home for signed-in users", () => {
    const home = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
    const aoChef = readFileSync(
      join(process.cwd(), "components/dashboard/AoChefDashboard.tsx"),
      "utf8",
    );
    const banner = readFileSync(
      join(process.cwd(), "components/auth/AuthErrorBanner.tsx"),
      "utf8",
    );
    assert.match(home, /AuthErrorBanner/);
    assert.match(home, /searchParams/);
    assert.match(aoChef, /AuthErrorBanner/);
    assert.match(banner, /unauthorized/);
    assert.match(banner, /role="alert"/);
  });
});
