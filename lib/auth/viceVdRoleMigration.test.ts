import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const roleSql = readFileSync(
  fileURLToPath(
    new URL("../../supabase/migrations/20260826120000_vice_vd_role.sql", import.meta.url),
  ),
  "utf8",
);
const permissionsSql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260826120100_vice_vd_permissions.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("vice_vd role migrations", () => {
  it("adds the enum value in a separate file from using it", () => {
    assert.match(roleSql, /alter type public\.app_role add value if not exists 'vice_vd'/);
    assert.doesNotMatch(roleSql, /is_vd_equivalent/);
  });

  it("defines is_vd_equivalent as vd and vice_vd", () => {
    assert.match(
      permissionsSql,
      /create or replace function public\.is_vd_equivalent\(\)/,
    );
    assert.match(
      permissionsSql,
      /has_app_role\(array\['vd', 'vice_vd'\]::public\.app_role\[\]\)/,
    );
  });

  it("lets vice_vd administer users, write like vd, and use briefing", () => {
    assert.match(permissionsSql, /create or replace function public\.can_administer_users/);
    assert.match(permissionsSql, /public\.is_vd_equivalent\(\)/);
    assert.match(
      permissionsSql,
      /v_role not in \('vd', 'vice_vd', 'ao_chef'\)/,
    );
    assert.match(
      permissionsSql,
      /vd_briefing_v1' and v_role not in \('vd', 'vice_vd'\)/,
    );
    assert.doesNotMatch(permissionsSql, /169202b9-ee9a-47f3-9e0d-5e69898c6f7d/);
    assert.doesNotMatch(permissionsSql.toLowerCase(), /sunesson/);
    assert.doesNotMatch(permissionsSql.toLowerCase(), /peter\.sunesson/);
  });
});
