import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("AI server boundaries", () => {
  it("accepts only prompt text from the assistant client", () => {
    const action = read("app/assistant/actions.ts");
    assert.match(
      action,
      /export async function askAssistant\(question: string\)/,
    );
    assert.doesNotMatch(
      action,
      /(businessAreaId|business_area_id|scope|role|userId)\s*:/,
    );
  });

  it("rates both endpoints before context/provider execution", () => {
    const assistantAction = read("app/assistant/actions.ts");
    const briefingAction = read("app/dashboard/briefing-actions.ts");
    assert.match(assistantAction, /requireRateLimitThenRun\(/);
    assert.match(briefingAction, /requireRateLimitThenRun\(/);
    assert.ok(
      assistantAction.indexOf("consumeAiRateLimit") <
        assistantAction.indexOf("runAssistant(trimmed"),
    );
    assert.ok(
      briefingAction.indexOf("consumeAiRateLimit") <
        briefingAction.indexOf("generateVdBriefing(principal)"),
    );
  });

  it("keeps the migration isolated and atomic", () => {
    const sql = read(
      "supabase/migrations/20260818260000_ai_rate_limits.sql",
    ).toLowerCase();
    for (const forbidden of [
      "update public.kpis",
      "update public.profiles",
      "insert into public.profiles",
      "auth.users",
      "alter policy",
      "drop policy",
    ]) {
      assert.doesNotMatch(sql, new RegExp(forbidden.replace(".", "\\.")));
    }
    assert.match(sql, /for update of b/);
    assert.match(sql, /security definer/);
    assert.match(sql, /auth\.uid\(\)/);
    assert.match(sql, /v_role is null/);
    assert.match(sql, /enable row level security/);
  });

  it("keeps safe local fallbacks without bypassing principal scope", () => {
    const service = read("services/assistant.ts");
    assert.match(
      service,
      /buildAssistantContext\(\s*principal: AiPrincipal/,
    );
    assert.match(service, /answerLocal\(trimmed, fullContext\)/);
    assert.match(service, /getKPIs\(\{ businessAreaId: areaId \}\)/);
    assert.match(service, /assertRowsInAiScope\(principal, allKpis/);
  });
});
