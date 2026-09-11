import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("reporting unit admin", () => {
  it("authorizes inside every exported action", () => {
    const actions = read("app/admin/reporting-units/actions.ts");
    assert.match(actions, /^"use server";/m);

    const exported = [
      "createReportingUnitAction",
      "updateReportingUnitAction",
      "setReportingUnitActiveAction",
    ];

    for (const name of exported) {
      const fn = actions.match(
        new RegExp(`export async function ${name}[\\s\\S]*?^}`, "m"),
      );
      assert.ok(fn, `missing action ${name}`);
      const requireIndex = fn[0]!.indexOf("requireUserAdministrator()");
      assert.ok(requireIndex >= 0, `${name} lacks requireUserAdministrator()`);
    }
  });

  it("keeps the admin page behind VD / Vice VD / administrator", () => {
    const page = read("app/admin/reporting-units/page.tsx");
    assert.match(page, /requireUserAdministrator\(\)/);
    assert.doesNotMatch(page, /createServiceRoleClient/);
    assert.doesNotMatch(page, /Åkeri/);
    assert.match(page, /Rapportenheter/);
  });
});
