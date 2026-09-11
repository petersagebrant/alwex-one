import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

const migration = read(
  "../../supabase/migrations/20260911080000_reporting_units.sql",
);
const normalized = migration.replace(/\s+/g, " ").toLowerCase();

describe("reporting_units migration", () => {
  it("creates reporting_units with unique code and optional default BA", () => {
    assert.match(normalized, /create table public\.reporting_units/);
    assert.match(normalized, /constraint reporting_units_code_unique unique \(code\)/);
    assert.match(normalized, /default_business_area_id uuid null/);
    assert.match(normalized, /references public\.business_areas \(id\) on delete set null/);
    assert.match(normalized, /is_active boolean not null default true/);
    assert.match(normalized, /sort_order integer not null default 0/);
    assert.doesNotMatch(normalized, /create table public\.business_areas/);
  });

  it("exposes active units via RPC and does not grant anon table select", () => {
    assert.match(
      normalized,
      /create or replace function public\.list_reporting_units\(\)/,
    );
    assert.match(normalized, /where ru\.is_active = true/);
    assert.match(
      normalized,
      /grant execute on function public\.list_reporting_units\(\) to anon/,
    );
    assert.match(
      normalized,
      /revoke all on table public\.reporting_units from anon/,
    );
    assert.doesNotMatch(
      normalized,
      /grant select on table public\.reporting_units to anon/,
    );
    assert.doesNotMatch(normalized, /grant delete on table public\.reporting_units/);
  });

  it("limits authenticated write to vd, vice vd and administrator", () => {
    assert.match(normalized, /public\.is_vd_equivalent\(\)/);
    assert.match(
      normalized,
      /has_app_role\(array\['administrator'\]::public\.app_role\[\]\)/,
    );
    assert.match(
      normalized,
      /grant select, insert, update on table public\.reporting_units to authenticated/,
    );
  });
});

describe("public reporting units access", () => {
  it("lists units through the RPC, not a table select", () => {
    const row = read("../supabase/reporting-units.ts");
    const service = read("../../services/operationalReports.ts");
    const actions = read("../../app/rapportera/actions.ts");
    const start = row.indexOf("export async function listPublicReportingUnits");
    const next = row.indexOf("\nexport ", start + 1);
    const publicList = next === -1 ? row.slice(start) : row.slice(start, next);
    assert.match(publicList, /rpc\("list_reporting_units"\)/);
    assert.match(publicList, /createAnonClient\(\)/);
    assert.doesNotMatch(publicList, /\.from\("reporting_units"\)/);
    assert.match(service, /listPublicReportingUnits/);
    assert.match(actions, /getPublicReportingUnits/);
    assert.doesNotMatch(row, /service_role|SERVICE_ROLE/);
  });
});
