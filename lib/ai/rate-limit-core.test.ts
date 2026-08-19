import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AiRateLimitError,
  requireRateLimitThenRun,
  type AiRateLimitDecision,
} from "./rate-limit-core";

function decision(allowed: boolean, remaining: number): AiRateLimitDecision {
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : 42,
    limit: 10,
    remaining,
  };
}

describe("AI rate-limit orchestration", () => {
  it("runs under and at the exact limit", async () => {
    let calls = 0;
    for (const remaining of [1, 0]) {
      const result = await requireRateLimitThenRun(
        async () => decision(true, remaining),
        async () => ++calls,
      );
      assert.equal(result, calls);
    }
    assert.equal(calls, 2);
  });

  it("never invokes OpenAI work after the limit", async () => {
    let openAiCalls = 0;
    await assert.rejects(
      requireRateLimitThenRun(
        async () => decision(false, 0),
        async () => {
          openAiCalls += 1;
          return "provider";
        },
      ),
      AiRateLimitError,
    );
    assert.equal(openAiCalls, 0);
  });

  it("keeps independently supplied users isolated", async () => {
    const remaining = new Map([
      ["user-a", 1],
      ["user-b", 1],
    ]);
    const consume = (userId: string) => async () => {
      const before = remaining.get(userId) ?? 0;
      remaining.set(userId, Math.max(before - 1, 0));
      return decision(before > 0, Math.max(before - 1, 0));
    };
    assert.equal(
      await requireRateLimitThenRun(consume("user-a"), async () => "a"),
      "a",
    );
    assert.equal(
      await requireRateLimitThenRun(consume("user-b"), async () => "b"),
      "b",
    );
    await assert.rejects(
      requireRateLimitThenRun(consume("user-a"), async () => "blocked"),
      AiRateLimitError,
    );
  });
});
