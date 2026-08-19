import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

async function recoveryHandler() {
  return (await import(
    new URL("./handler.ts", import.meta.url).href
  )) as typeof import("./handler");
}

const COOKIE_NAME = "alwex_pw_recovery";

function request(
  headers: Record<string, string>,
  body = "{}",
  url = "https://portal.example/auth/recovery-flag",
) {
  return new Request(url, {
    method: "POST",
    headers: {
      host: "portal.example",
      ...headers,
    },
    body,
  });
}

async function handle(
  candidate: Request,
  authenticated: boolean,
  secureCookie = true,
) {
  let authChecks = 0;
  const { handleRecoveryFlagPost } = await recoveryHandler();
  const response = await handleRecoveryFlagPost(candidate, {
    cookieName: COOKIE_NAME,
    secureCookie,
    async hasAuthenticatedUser() {
      authChecks += 1;
      return authenticated;
    },
  });
  return { response, authChecks };
}

function assertNoCookie(response: Response) {
  assert.equal(response.headers.get("set-cookie"), null);
}

describe("recovery flag POST", () => {
  it("rejects a missing Origin before auth", async () => {
    const { response, authChecks } = await handle(
      request({ "content-type": "application/json" }),
      true,
    );

    assert.equal(response.status, 403);
    assert.equal(authChecks, 0);
    assertNoCookie(response);
  });

  it("rejects a foreign Origin before auth", async () => {
    const { response, authChecks } = await handle(
      request({
        "content-type": "application/json",
        origin: "https://attacker.example",
      }),
      true,
    );

    assert.equal(response.status, 403);
    assert.equal(authChecks, 0);
    assertNoCookie(response);
  });

  it("rejects wrong and form Content-Types before auth", async () => {
    for (const contentType of [
      "text/plain",
      "application/x-www-form-urlencoded",
      "application/json; charset=utf-8",
    ]) {
      const { response, authChecks } = await handle(
        request(
          {
            "content-type": contentType,
            origin: "https://portal.example",
          },
          contentType === "application/x-www-form-urlencoded" ? "x=1" : "{}",
        ),
        true,
      );

      assert.equal(response.status, 403);
      assert.equal(authChecks, 0);
      assertNoCookie(response);
    }
  });

  it("rejects same-origin requests without a valid server user", async () => {
    const { response, authChecks } = await handle(
      request({
        "content-type": "application/json",
        origin: "https://portal.example",
      }),
      false,
    );

    assert.equal(response.status, 401);
    assert.equal(authChecks, 1);
    assertNoCookie(response);
  });

  it("accepts a valid forwarded origin and sets only the recovery cookie", async () => {
    const { response, authChecks } = await handle(
      request(
        {
          "content-type": "application/json",
          origin: "https://portal.example",
          "x-forwarded-host": "portal.example",
          "x-forwarded-proto": "https",
          host: "internal.example",
        },
        "{}",
        "http://internal.example/auth/recovery-flag",
      ),
      true,
    );

    assert.equal(response.status, 200);
    assert.equal(authChecks, 1);
    assert.equal(
      response.headers.get("set-cookie"),
      `${COOKIE_NAME}=1; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=3600`,
    );
  });

  it("accepts only an empty JSON object and never authenticates token-shaped input", async () => {
    for (const body of [
      "[]",
      "null",
      '{"token":"secret"}',
      '{"role":"admin"}',
      '{"scope":"recovery"}',
    ]) {
      const { response, authChecks } = await handle(
        request(
          {
            "content-type": "application/json",
            origin: "https://portal.example",
          },
          body,
        ),
        true,
      );

      assert.equal(response.status, 400);
      assert.equal(authChecks, 0);
      assertNoCookie(response);
    }
  });

  it("fails closed for ambiguous forwarded headers", async () => {
    const { response, authChecks } = await handle(
      request({
        "content-type": "application/json",
        origin: "https://portal.example",
        "x-forwarded-host": "portal.example, attacker.example",
        "x-forwarded-proto": "https",
      }),
      true,
    );

    assert.equal(response.status, 403);
    assert.equal(authChecks, 0);
    assertNoCookie(response);
  });
});

describe("recovery integration regressions", () => {
  it("exposes POST only, backed by Supabase getUser", () => {
    const source = readFileSync(join(import.meta.dirname, "route.ts"), "utf8");

    assert.match(source, /export async function POST\(request: Request\)/);
    assert.match(source, /supabase\.auth\.getUser\(\)/);
    assert.doesNotMatch(source, /export async function DELETE/);
  });

  it("browser calls are same-origin JSON and occur after recovery session evidence", () => {
    const gate = readFileSync(
      join(process.cwd(), "components/auth/AuthRecoveryGate.tsx"),
      "utf8",
    );
    const form = readFileSync(
      join(
        process.cwd(),
        "app/auth/update-password/update-password-form.tsx",
      ),
      "utf8",
    );

    for (const source of [gate, form]) {
      assert.match(source, /method: "POST"/);
      assert.match(source, /mode: "same-origin"/);
      assert.match(source, /credentials: "same-origin"/);
      assert.match(source, /"Content-Type": "application\/json"/);
      assert.match(source, /body: "\{\}"/);
    }

    assert.ok(
      gate.indexOf("await supabase.auth.setSession") <
        gate.indexOf("await setServerRecoveryFlag()"),
    );
    assert.match(gate, /event === "PASSWORD_RECOVERY" && session/);
    assert.ok(
      form.indexOf("await supabase.auth.setSession") <
        form.indexOf('await fetch("/auth/recovery-flag"'),
    );
    assert.match(form, /window\.history\.replaceState/);
  });

  it("preserves callback and password/login completion paths", () => {
    const callback = readFileSync(
      join(process.cwd(), "app/auth/callback/route.ts"),
      "utf8",
    );
    const updateAction = readFileSync(
      join(process.cwd(), "app/auth/update-password/actions.ts"),
      "utf8",
    );
    const loginAction = readFileSync(
      join(process.cwd(), "app/login/actions.ts"),
      "utf8",
    );

    assert.match(callback, /exchangeCodeForSession\(code\)/);
    assert.match(callback, /verifyOtp\(\{/);
    assert.match(callback, /token_hash: tokenHash/);
    assert.match(updateAction, /supabase\.auth\.updateUser/);
    assert.match(updateAction, /supabase\.auth\.signOut/);
    assert.match(updateAction, /await clearRecoveryCookie\(\)/);
    assert.match(loginAction, /export async function signInAction/);
    assert.match(loginAction, /export async function signOutAction/);
    assert.match(loginAction, /await clearRecoveryCookie\(\)/);
  });
});
