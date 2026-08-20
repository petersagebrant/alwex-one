import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeTrendFromHistory,
  resolveKpiTrend,
} from "./resolveTrend";

describe("computeTrendFromHistory", () => {
  it("returns null with fewer than two numeric points", () => {
    assert.equal(computeTrendFromHistory([]), null);
    assert.equal(computeTrendFromHistory([{ value: "10" }]), null);
    assert.equal(
      computeTrendFromHistory([{ value: "10" }, { value: "x" }]),
      null,
    );
  });

  it("detects Upp / Ner / Oförändrad from last two points", () => {
    assert.equal(
      computeTrendFromHistory([{ value: "12" }, { value: "10" }]),
      "Upp",
    );
    assert.equal(
      computeTrendFromHistory([{ value: "8" }, { value: "10" }]),
      "Ner",
    );
    assert.equal(
      computeTrendFromHistory([{ value: "10" }, { value: "10" }]),
      "Oförändrad",
    );
  });

  it("handles Swedish decimal comma", () => {
    assert.equal(
      computeTrendFromHistory([{ value: "10,5" }, { value: "9,5" }]),
      "Upp",
    );
  });
});

describe("resolveKpiTrend", () => {
  it("uses stored trend when consistent with history", () => {
    assert.equal(
      resolveKpiTrend("Upp", [{ value: "12" }, { value: "10" }]),
      "Upp",
    );
  });

  it("prefers stored Upp/Ner when inconsistent with history", () => {
    assert.equal(
      resolveKpiTrend("Ner", [{ value: "12" }, { value: "10" }]),
      "Ner",
    );
  });

  it("computes from history when stored is Oförändrad", () => {
    assert.equal(
      resolveKpiTrend("Oförändrad", [{ value: "12" }, { value: "10" }]),
      "Upp",
    );
  });

  it("falls back to stored when history is insufficient", () => {
    assert.equal(resolveKpiTrend("Upp", [{ value: "12" }]), "Upp");
    assert.equal(resolveKpiTrend(null, []), "Oförändrad");
  });
});
