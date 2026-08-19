import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAiCacheKey, ScopedSingleflightCache } from "./cache";

function key(role: string, userId: string, scope: string) {
  return buildAiCacheKey({
    feature: "vd-briefing",
    version: 6,
    role,
    userId,
    scope,
  });
}

describe("AI scoped cache", () => {
  it("isolates VD/AO, users and areas", () => {
    const keys = new Set([
      key("vd", "vd-1", "organization"),
      key("vd", "vd-2", "organization"),
      key("ao_chef", "ao-1", "business-area:a"),
      key("ao_chef", "ao-2", "business-area:a"),
      key("ao_chef", "ao-1", "business-area:b"),
    ]);
    assert.equal(keys.size, 5);
  });

  it("shares only same-key in-flight work", async () => {
    const cache = new ScopedSingleflightCache<string>();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const factory = async () => {
      calls += 1;
      const call = calls;
      await gate;
      return `value-${call}`;
    };

    const sameA = cache.getOrCreate(key("vd", "vd-1", "organization"), 300_000, factory);
    const sameB = cache.getOrCreate(key("vd", "vd-1", "organization"), 300_000, factory);
    const other = cache.getOrCreate(key("vd", "vd-2", "organization"), 300_000, factory);
    assert.equal(calls, 2);
    release();
    const [a, b, c] = await Promise.all([sameA, sameB, other]);
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});
