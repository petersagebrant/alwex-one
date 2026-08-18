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
    if (!sourceExtension.test(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) {
      return [];
    }
    return [path];
  });
}

describe("production runtime mock isolation", () => {
  it("has no static or dynamic path from production code to data/mock", () => {
    const files = runtimeRoots.flatMap((directory) =>
      runtimeSourceFiles(join(root, directory)),
    );

    for (const path of files) {
      const source = readFileSync(path, "utf8");
      const displayPath = relative(root, path);

      assert.doesNotMatch(
        source,
        /(?:@\/data\/mock|\bdata\/mock\b)/,
        `${displayPath} references data/mock`,
      );

      for (const match of source.matchAll(
        /\b(?:import|require)\s*\(([\s\S]*?)\)/g,
      )) {
        assert.doesNotMatch(
          match[1] ?? "",
          /\bmock\b/i,
          `${displayPath} dynamically constructs a mock import`,
        );
      }
    }
  });

  it("uses real sources and honest missing, empty, and error states", () => {
    const detailPage = readFileSync(
      join(root, "app/areas/[slug]/page.tsx"),
      "utf8",
    );
    const listPage = readFileSync(join(root, "app/areas/page.tsx"), "utf8");
    const errorPage = readFileSync(join(root, "app/areas/error.tsx"), "utf8");
    const areaService = readFileSync(
      join(root, "services/businessAreas.ts"),
      "utf8",
    );
    const historyService = readFileSync(
      join(root, "services/auditLog.ts"),
      "utf8",
    );
    const historyList = readFileSync(
      join(root, "components/areas/AreaHistoryList.tsx"),
      "utf8",
    );

    assert.match(detailPage, /if \(!dbArea\)\s*\{\s*notFound\(\)/);
    assert.doesNotMatch(detailPage, /\.catch\(\(\) => \[\]\)/);
    assert.match(detailPage, /getBusinessAreaHistory\(dbArea\.id/);
    assert.match(areaService, /fetchAllGoals\(\)/);
    assert.match(areaService, /fetchAllActivities\(\)/);
    assert.match(historyService, /fetchAuditLogByBusinessAreaId\(/);
    assert.match(listPage, /Inga verksamheter finns ännu\./);
    assert.match(historyList, /Ingen historik registrerad\./);
    assert.match(errorPage, /Affärsområdesdata kunde inte hämtas/);
    assert.match(errorPage, /datakällan inte är tillgänglig/);
  });
});
