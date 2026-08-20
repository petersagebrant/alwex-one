import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260820120000_profiles_user_admin.sql",
    import.meta.url,
  ),
);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/\s+/g, " ").toLowerCase();

describe("profiles user admin migration", () => {
  it("adds display_name and disabled_at", () => {
    assert.match(normalized, /add column if not exists display_name text not null default ''/);
    assert.match(normalized, /add column if not exists disabled_at timestamptz null/);
  });

  it("lets vd and administrator administer users", () => {
    assert.match(
      normalized,
      /array\['vd', 'administrator'\]::public\.app_role\[\]/,
    );
    assert.doesNotMatch(
      normalized,
      /can_administer_users\(\)[\s\S]*array\['administrator'\]::public\.app_role\[\]/,
    );
  });

  it("treats disabled_at as a missing profile in helpers", () => {
    assert.match(normalized, /and p\.disabled_at is null/);
    const hasAppRole = sql.match(
      /create or replace function public\.has_app_role[\s\S]*?as \$\$([\s\S]*?)\$\$;/i,
    );
    assert.ok(hasAppRole);
    assert.match(hasAppRole[1]!.toLowerCase(), /disabled_at is null/);
  });

  it("blocks self role and area changes", () => {
    assert.match(normalized, /prevent_self_role_or_area_change/);
    assert.match(normalized, /new\.id = auth\.uid\(\)/);
    assert.match(normalized, /new\.role is distinct from old\.role/);
    assert.match(normalized, /new\.business_area_id is distinct from old\.business_area_id/);
  });

  it("protects the hardcoded VD and AO-test UUIDs", () => {
    assert.match(sql, /169202b9-ee9a-47f3-9e0d-5e69898c6f7d/);
    assert.match(sql, /6d867c73-2196-4c8f-a247-7e91f9f12aca/);
    assert.match(normalized, /skyddat systemkonto kan inte raderas/);
    assert.match(normalized, /skyddat systemkonto kan inte inaktiveras/);
    assert.match(normalized, /vd-kontot kan inte nedgraderas/);
  });

  it("revokes broad grants in the same spirit as 28000", () => {
    assert.match(normalized, /revoke all privileges on table public\.profiles from public/);
    assert.match(normalized, /revoke truncate, references, trigger, maintain/);
    assert.match(
      normalized,
      /grant select, insert, update, delete on table public\.profiles to authenticated/,
    );
  });

  it("does not auto-provision from auth.users and tells 24000 not to return", () => {
    assert.doesNotMatch(normalized, /create trigger[\s\S]*on auth\.users/);
    assert.doesNotMatch(normalized, /insert into public\.profiles[\s\S]*auth\.users/);
    assert.match(sql, /24000/);
    assert.match(normalized, /no trigger on auth\.users/);
  });

  it("treats disabled profiles as missing in the session helper", () => {
    const source = readFileSync(
      new URL("../supabase/profiles.ts", import.meta.url),
      "utf8",
    );
    assert.match(source, /if \(!data \|\| data\.disabled_at\) \{\s*return null;/);
  });
});
