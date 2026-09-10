import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

function sliceExport(source: string, name: string): string {
  const markers = [
    `export async function ${name}`,
    `export function ${name}`,
    `export type ${name}`,
  ];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  assert.ok(start != null && start >= 0, `missing ${name}`);
  const next = source.indexOf("\nexport ", start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

describe("activity detail escalation history", () => {
  it("attaches activity_escalations in getActivityById without failing the page", () => {
    const getActivityById = sliceExport(
      read("../../services/activities.ts"),
      "getActivityById",
    );
    assert.match(getActivityById, /loadEscalationsByActivityIds/);
    assert.match(getActivityById, /\.catch\(\(\) => new Map\(\)\)/);
    assert.match(
      getActivityById,
      /escalations: escalationsByActivity\.get\(row\.id\) \?\? \[\]/,
    );
    assert.doesNotMatch(getActivityById, /status === "Klar"/);
    assert.doesNotMatch(getActivityById, /filterOpenActivities/);
  });

  it("shows full escalation history on the detail page even when status is Klar", () => {
    const page = read("./[id]/page.tsx");
    const history = read(
      "../../components/daglig-styrning/ActivityEscalationHistory.tsx",
    );
    assert.match(page, /ActivityEscalationHistory/);
    assert.match(page, /Eskaleringshistorik/);
    assert.match(page, /activity\.escalations\.length > 0/);
    assert.match(page, /escalations=\{activity\.escalations\}/);
    assert.doesNotMatch(
      page,
      /activity\.status\s*!==\s*"Klar"[\s\S]*ActivityEscalationHistory/,
    );
    assert.doesNotMatch(
      page,
      /activity\.status\s*===\s*"Klar"[\s\S]*ActivityEscalationHistory/,
    );
    const metadataAt = page.indexOf("Affärsområde");
    const historyAt = page.indexOf("Eskaleringshistorik");
    const commentsAt = page.indexOf("Kommentarer");
    assert.ok(metadataAt > 0 && historyAt > metadataAt && historyAt < commentsAt);

    assert.match(history, /Eskalerat av/);
    assert.match(history, /Besvarat av/);
    assert.match(history, /Beslut\/svar:/);
    assert.match(history, /formatDateTimeSv\(item\.askedAt\)/);
    assert.match(history, /formatDateTimeSv\(item\.repliedAt\)/);
    assert.doesNotMatch(history, /Klar/);
  });
});
