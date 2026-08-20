import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const runtimeRoots = ["app", "components", "lib", "services"];
const sourceExtension = /\.(?:[cm]?[jt]sx?)$/;

function runtimeSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return runtimeSourceFiles(path);
    }
    if (
      !sourceExtension.test(path) ||
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)
    ) {
      return [];
    }
    return [path];
  });
}

describe("service role isolation", () => {
  const files = runtimeRoots.flatMap((directory) =>
    runtimeSourceFiles(join(root, directory)),
  );

  it("never prefixes the service role key with NEXT_PUBLIC_", () => {
    for (const path of files) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(
        source,
        /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/,
        `${relative(root, path)} exposes a public service role env var`,
      );
    }
  });

  it("keeps the admin client server-only", () => {
    const admin = readFileSync(join(root, "lib/supabase/admin.ts"), "utf8");
    assert.match(admin, /^import "server-only";/m);
    assert.match(admin, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(admin, /NEXT_PUBLIC_SUPABASE_/);
  });

  it("does not put service-role usage on client code paths", () => {
    const allowed = new Set([
      join(root, "lib/supabase/admin.ts"),
      join(root, "services/users.ts"),
    ]);

    for (const path of files) {
      if (allowed.has(path)) {
        continue;
      }
      const source = readFileSync(path, "utf8");
      const displayPath = relative(root, path);

      assert.doesNotMatch(
        source,
        /createServiceRoleClient/,
        `${displayPath} uses the service-role client`,
      );
      assert.doesNotMatch(
        source,
        /SUPABASE_SERVICE_ROLE_KEY/,
        `${displayPath} reads the service role key`,
      );
      assert.doesNotMatch(
        source,
        /\bservice_role\b/,
        `${displayPath} mentions service_role`,
      );
    }
  });

  it("writes profiles with the caller JWT client, not service_role DML", () => {
    const users = readFileSync(join(root, "services/users.ts"), "utf8");
    const profiles = readFileSync(join(root, "lib/supabase/profiles.ts"), "utf8");
    const admin = readFileSync(join(root, "lib/supabase/admin.ts"), "utf8");

    assert.match(profiles, /from "@\/lib\/supabase\/server"/);
    assert.match(profiles, /\.from\("profiles"\)/);
    assert.doesNotMatch(profiles, /createServiceRoleClient/);
    assert.doesNotMatch(admin, /\.from\(["']profiles["']\)/);
    assert.match(users, /inviteUserByEmail/);
    assert.match(users, /generateLink/);
    assert.match(users, /ban_duration/);
  });
});
