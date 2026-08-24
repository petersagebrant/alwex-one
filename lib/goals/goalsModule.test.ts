import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const KEEP_ID = "2db72ed9-9e99-4340-94db-36e3d050b311";
const DELETE_IDS = [
  "9297644f-2402-4a2c-ba19-e1078392ee8e",
  "5808ea0d-76c6-4212-80a5-3f8a4c241c2e",
  "78f1229f-8a10-4428-b8a8-2fedaad41de8",
  "9bf64c7e-6129-43c2-bab3-b0b79cc4e9e7",
  "3b5c0379-a602-49a0-8e7c-d9a316914a7c",
  "7ff9dc35-132b-4e43-8694-91795dfce7da",
  "9f4d3dbb-2342-4861-9459-7956a05fc8ba",
  "507f62a3-646e-45b6-9992-493bdcda34c4",
  "2805c42f-631b-4c38-a35d-43c1efc68674",
  "ccd857d8-2982-4321-9188-d144e114697f",
  "c84bf957-0f00-414f-8cd8-e42a60b99fb3",
  "6bababc1-3d21-4745-851e-10f18c7fbac1",
] as const;

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260824160000_goals_archive_and_seed_cleanup.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").toLowerCase();

function read(relativeFromLibGoals: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeFromLibGoals, import.meta.url)),
    "utf8",
  );
}

describe("goals archive and seed cleanup migration", () => {
  it("deletes exactly the 12 seed UUIDs and keeps Fröträdet årsresultat", () => {
    assert.equal(DELETE_IDS.length, 12);
    for (const id of DELETE_IDS) {
      assert.match(migration, new RegExp(id));
    }
    assert.match(migration, new RegExp(KEEP_ID));
    assert.match(
      normalized,
      /delete from public\.goals where id in \(/,
    );
    assert.match(
      normalized,
      new RegExp(`and id <> '${KEEP_ID}'`),
    );
    assert.match(migration, /20260807110000/);
  });

  it("adds archived_at, owner_id and a partial unique title index", () => {
    assert.match(
      normalized,
      /add column if not exists archived_at timestamptz null/,
    );
    assert.match(
      normalized,
      /add column if not exists owner_id uuid references public\.profiles \(id\) on delete set null/,
    );
    assert.match(normalized, /drop index if exists public\.goals_business_area_id_title_uidx/);
    assert.match(
      normalized,
      /create unique index if not exists goals_business_area_id_title_active_uidx on public\.goals \(business_area_id, title\) where archived_at is null/,
    );
  });

  it("lets AO-chef archive own-area goals via can_write_operational", () => {
    assert.match(normalized, /prevent_unauthorized_goal_archive/);
    assert.match(normalized, /can_write_operational\(/);
    assert.doesNotMatch(
      normalized,
      /endast vd eller administratör kan arkivera eller återaktivera mål/,
    );
  });

  it("does not rewrite KPI tables or the original seed file", () => {
    assert.doesNotMatch(normalized, /alter table public\.kpis/);
    assert.doesNotMatch(normalized, /update public\.kpis/);
    assert.doesNotMatch(normalized, /delete from public\.kpis/);
    assert.doesNotMatch(normalized, /alter table public\.kpi_history/);
    assert.doesNotMatch(normalized, /update public\.kpi_history/);
    assert.doesNotMatch(normalized, /delete from public\.kpi_history/);
    const seed = read("../../supabase/migrations/20260807110000_seed_alwex_one_core_data.sql");
    assert.doesNotMatch(seed, new RegExp(DELETE_IDS[0]!));
    assert.match(seed, /insert into public\.goals/);
  });
});

describe("goals module operational filters and UI", () => {
  it("filters list queries to archived_at is null by default", () => {
    const supabaseGoals = read("../supabase/goals.ts");
    assert.match(supabaseGoals, /query = query\.is\("archived_at", null\)/);
    assert.equal(
      (supabaseGoals.match(/query = query\.is\("archived_at", null\)/g) ?? [])
        .length,
      2,
    );
  });

  it("hides create/edit for lasbehorighet and uses a person picker", () => {
    const page = read("../../app/admin/goals/page.tsx");
    const form = read("../../components/admin/GoalFormFields.tsx");
    const actions = read("../../app/admin/goals/actions.ts");
    const areaPage = read("../../app/areas/[slug]/page.tsx");
    const areaList = read("../../components/areas/AreaGoalsList.tsx");

    assert.match(page, /requireProfile/);
    assert.match(page, /canWriteGoals\(profile\.role\)/);
    assert.match(page, /canWrite && !showCreate && !showEdit/);
    assert.match(form, /name="ownerId"/);
    assert.doesNotMatch(form, /name="owner"/);
    assert.match(form, /htmlFor="ownerId"/);
    assert.match(actions, /ownerId: fields\.ownerId/);
    assert.match(actions, /requireOperationalWriter/);
    assert.match(areaPage, /canWriteGoalsForArea/);
    assert.match(areaList, /Nytt mål/);
    assert.match(areaList, /newGoalHref/);
  });

  it("keeps dashboard and assistant on the active getGoals list", () => {
    const dashboard = read("../../services/dashboard.ts");
    const assistant = read("../../services/assistant.ts");
    const aoChef = read("../../services/aoChefDashboard.ts");
    assert.match(dashboard, /getGoals\(\)/);
    assert.doesNotMatch(dashboard, /includeArchived:\s*true/);
    assert.match(assistant, /getGoals\(/);
    assert.doesNotMatch(assistant, /includeArchived:\s*true/);
    assert.match(aoChef, /getGoalsByBusinessAreaId\(businessAreaId\)/);
  });
});
