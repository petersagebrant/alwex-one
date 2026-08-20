import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(
  new URL(
    "../../supabase/migrations/20260818280000_scope_kpi_calc_write_policies.sql",
    import.meta.url,
  ),
);
const migration = readFileSync(migrationPath, "utf8");
const normalized = migration.replace(/\s+/g, " ").trim().toLowerCase();

const policyNames = [
  "kpi_calc_sum_numerators_insert_authenticated",
  "kpi_calc_sum_numerators_update_authenticated",
  "kpi_calc_sum_numerators_delete_authenticated",
  "kpi_calc_weighted_inputs_insert_authenticated",
  "kpi_calc_weighted_inputs_update_authenticated",
  "kpi_calc_weighted_inputs_delete_authenticated",
] as const;

function policySql(name: string): string {
  const match = migration.match(
    new RegExp(`create policy ${name}[\\s\\S]*?;`, "i"),
  );
  assert.ok(match, `missing policy ${name}`);
  return match[0].replace(/\s+/g, " ").toLowerCase();
}

type AppRole =
  | "vd"
  | "administrator"
  | "ao_chef"
  | "lasbehorighet"
  | "profileless"
  | "anon"
  | "service_role";

type Relation = {
  operator: "SUM_DIVIDE" | "WEIGHTED_RATIO_PERCENT" | "INVALID";
  parentArea: string;
  parentSlug: string;
  numeratorArea: string;
  denominatorArea: string | null;
};

function canWriteOperational(
  role: AppRole,
  profileArea: string | null,
  area: string,
): boolean {
  return (
    role === "vd" ||
    role === "administrator" ||
    (role === "ao_chef" && profileArea === area)
  );
}

function canManageBusinessAreas(role: AppRole): boolean {
  return role === "vd" || role === "administrator";
}

function permitsSum(
  role: AppRole,
  profileArea: string | null,
  relation: Relation,
): boolean {
  if (role === "service_role") return true;
  return (
    relation.operator === "SUM_DIVIDE" &&
    relation.denominatorArea !== null &&
    relation.numeratorArea === relation.parentArea &&
    relation.denominatorArea === relation.parentArea &&
    canWriteOperational(role, profileArea, relation.parentArea)
  );
}

function permitsWeighted(
  role: AppRole,
  profileArea: string | null,
  relation: Relation,
): boolean {
  if (role === "service_role") return true;
  if (
    relation.operator !== "WEIGHTED_RATIO_PERCENT" ||
    relation.denominatorArea !== relation.numeratorArea
  ) {
    return false;
  }
  const sourceArea = relation.numeratorArea;
  return relation.parentArea === sourceArea
    ? canWriteOperational(role, profileArea, sourceArea)
    : relation.parentSlug === "alwex-totalt" &&
        canManageBusinessAreas(role) &&
        canWriteOperational(role, profileArea, sourceArea);
}

describe("scoped KPI calculation-input migration", () => {
  it("is transactional, forward-only, and changes only write policies/grants", () => {
    assert.match(normalized, /^--[\s\S]* begin;/);
    assert.match(normalized, /commit;$/);

    const droppedPolicies = [
      ...migration.matchAll(/drop policy if exists\s+(\w+)/gi),
    ].map((match) => match[1]);
    assert.deepEqual(droppedPolicies, [
      "kpi_calc_sum_numerators_write_authenticated",
      "kpi_calc_weighted_inputs_write_authenticated",
    ]);

    const createdPolicies = [
      ...migration.matchAll(/create policy\s+(\w+)/gi),
    ].map((match) => match[1]);
    assert.deepEqual(createdPolicies, policyNames);
    assert.doesNotMatch(migration, /select_authenticated/i);
    assert.doesNotMatch(migration, /\bfor\s+select\b/i);
    assert.doesNotMatch(migration, /\bcreate\s+(or\s+replace\s+)?function\b/i);
    assert.doesNotMatch(
      migration,
      /\balter\s+table\b[\s\S]*?\b(enable|disable|force|no force)\s+row\s+level\s+security\b/i,
    );
    assert.doesNotMatch(
      migration,
      /^\s*(insert\s+into|update\s+public\.|delete\s+from|truncate\s+table)\b/im,
    );
  });

  it("creates separate INSERT, UPDATE, and DELETE old/new checks", () => {
    for (const table of [
      "kpi_calc_sum_numerators",
      "kpi_calc_weighted_inputs",
    ]) {
      const insert = policySql(`${table}_insert_authenticated`);
      const update = policySql(`${table}_update_authenticated`);
      const remove = policySql(`${table}_delete_authenticated`);

      assert.match(insert, /\bfor insert\b/);
      assert.match(insert, /\bwith check \(/);
      assert.doesNotMatch(insert, /\busing \(/);
      assert.match(update, /\bfor update\b/);
      assert.match(update, /\busing \(/);
      assert.match(update, /\bwith check \(/);
      assert.match(remove, /\bfor delete\b/);
      assert.match(remove, /\busing \(/);
      assert.doesNotMatch(remove, /\bwith check \(/);
    }
  });

  it("encodes same-area SUM and local/global weighted invariants", () => {
    for (const command of ["insert", "update", "delete"] as const) {
      const sum = policySql(
        `kpi_calc_sum_numerators_${command}_authenticated`,
      );
      assert.match(sum, /parent\.calc_operator = 'sum_divide'/);
      assert.match(
        sum,
        /denominator\.id = parent\.calc_denominator_kpi_id/,
      );
      assert.match(
        sum,
        /numerator\.business_area_id = parent\.business_area_id/,
      );
      assert.match(
        sum,
        /denominator\.business_area_id = parent\.business_area_id/,
      );
      assert.match(
        sum,
        /public\.can_write_operational\(parent\.business_area_id\)/,
      );

      const weighted = policySql(
        `kpi_calc_weighted_inputs_${command}_authenticated`,
      );
      assert.match(
        weighted,
        /parent\.calc_operator = 'weighted_ratio_percent'/,
      );
      assert.match(
        weighted,
        /numerator\.business_area_id = denominator\.business_area_id/,
      );
      assert.match(weighted, /parent_area\.slug = 'alwex-totalt'/);
      assert.match(weighted, /public\.can_manage_business_areas\(\)/);
      assert.match(
        weighted,
        /public\.can_write_operational\(numerator\.business_area_id\)/,
      );
    }
  });

  it("leaves read grants intact and removes unnecessary write privileges", () => {
    assert.match(
      normalized,
      /revoke all privileges on table public\.kpi_calc_sum_numerators, public\.kpi_calc_weighted_inputs from public;/,
    );
    assert.match(
      normalized,
      /revoke insert, update, delete, truncate, references, trigger, maintain on table public\.kpi_calc_sum_numerators, public\.kpi_calc_weighted_inputs from anon;/,
    );
    assert.match(
      normalized,
      /grant select, insert, update, delete on table public\.kpi_calc_sum_numerators, public\.kpi_calc_weighted_inputs to authenticated;/,
    );
    assert.match(
      normalized,
      /revoke truncate, references, trigger, maintain on table public\.kpi_calc_sum_numerators, public\.kpi_calc_weighted_inputs from authenticated;/,
    );
    assert.doesNotMatch(migration, /\b(service_role|postgres)\b/i);
    assert.doesNotMatch(migration, /\bsequence\b/i);
  });
});

describe("KPI calculation-input authorization model", () => {
  const sumA: Relation = {
    operator: "SUM_DIVIDE",
    parentArea: "area-a",
    parentSlug: "area-a",
    numeratorArea: "area-a",
    denominatorArea: "area-a",
  };
  const localWeightedA: Relation = {
    operator: "WEIGHTED_RATIO_PERCENT",
    parentArea: "area-a",
    parentSlug: "area-a",
    numeratorArea: "area-a",
    denominatorArea: "area-a",
  };
  const localWeightedB: Relation = {
    ...localWeightedA,
    parentArea: "area-b",
    parentSlug: "area-b",
    numeratorArea: "area-b",
    denominatorArea: "area-b",
  };
  const globalWeightedA: Relation = {
    ...localWeightedA,
    parentArea: "global",
    parentSlug: "alwex-totalt",
  };

  it("covers VD, administrator, AO, read-only, profileless, anon, and service role", () => {
    for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
      assert.equal(permitsSum("vd", null, sumA), true, `${operation}: VD own`);
      assert.equal(
        permitsWeighted("vd", null, localWeightedB),
        true,
        `${operation}: VD other`,
      );
      assert.equal(
        permitsWeighted("administrator", null, globalWeightedA),
        true,
        `${operation}: administrator`,
      );
      assert.equal(
        permitsWeighted("ao_chef", "area-a", localWeightedA),
        true,
        `${operation}: AO A own`,
      );
      assert.equal(
        permitsWeighted("ao_chef", "area-a", localWeightedB),
        false,
        `${operation}: AO A other`,
      );
      assert.equal(
        permitsWeighted("ao_chef", "area-b", localWeightedB),
        true,
        `${operation}: AO B own`,
      );
      assert.equal(
        permitsSum("lasbehorighet", null, sumA),
        false,
        `${operation}: read-only`,
      );
      assert.equal(
        permitsSum("profileless", null, sumA),
        false,
        `${operation}: profileless`,
      );
      assert.equal(
        permitsSum("anon", null, sumA),
        false,
        `${operation}: anon`,
      );
      assert.equal(
        permitsSum("service_role", null, sumA),
        true,
        `${operation}: service role bypass`,
      );
    }
  });

  it("rejects area swaps, manipulated relations, and invalid source pairs", () => {
    const crossAreaSum = { ...sumA, numeratorArea: "area-b" };
    const missingDenominator = { ...sumA, denominatorArea: null };
    const wrongSumParent = { ...sumA, operator: "INVALID" as const };
    assert.equal(permitsSum("vd", null, crossAreaSum), false);
    assert.equal(permitsSum("vd", null, missingDenominator), false);
    assert.equal(permitsSum("vd", null, wrongSumParent), false);

    const invalidPair = {
      ...globalWeightedA,
      denominatorArea: "area-b",
    };
    const fakeGlobal = { ...globalWeightedA, parentSlug: "manipulated" };
    const wrongWeightedParent = {
      ...globalWeightedA,
      operator: "INVALID" as const,
    };
    assert.equal(permitsWeighted("vd", null, invalidPair), false);
    assert.equal(permitsWeighted("vd", null, fakeGlobal), false);
    assert.equal(permitsWeighted("vd", null, wrongWeightedParent), false);
    assert.equal(
      permitsWeighted("ao_chef", "area-a", globalWeightedA),
      false,
    );

    const oldAllowed = permitsWeighted(
      "ao_chef",
      "area-a",
      localWeightedA,
    );
    const newAllowed = permitsWeighted(
      "ao_chef",
      "area-a",
      localWeightedB,
    );
    assert.equal(oldAllowed && newAllowed, false, "old→new area swap");
  });

  it("models unchanged SELECT and tightened TRUNCATE behavior", () => {
    const canSelect = (role: AppRole) =>
      role === "service_role" || role !== "anon";
    assert.equal(canSelect("vd"), true);
    assert.equal(canSelect("ao_chef"), true);
    assert.equal(canSelect("lasbehorighet"), true);
    assert.equal(canSelect("profileless"), true);
    assert.equal(canSelect("anon"), false);
    assert.equal(canSelect("service_role"), true);

    const canTruncate = (role: AppRole) => role === "service_role";
    assert.equal(canTruncate("vd"), false);
    assert.equal(canTruncate("administrator"), false);
    assert.equal(canTruncate("ao_chef"), false);
    assert.equal(canTruncate("anon"), false);
    assert.equal(canTruncate("service_role"), true);
  });

  it("keeps current app runtime dependencies SELECT-only", () => {
    for (const relativePath of [
      "../supabase/kpi-calc-sum-numerators.ts",
      "../supabase/kpi-calc-weighted-inputs.ts",
    ]) {
      const source = readFileSync(
        fileURLToPath(new URL(relativePath, import.meta.url)),
        "utf8",
      );
      assert.match(source, /\.select\(/);
      assert.doesNotMatch(source, /\.(insert|update|delete|upsert)\(/);
    }
  });
});
