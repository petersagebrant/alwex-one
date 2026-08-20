import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isExcludedFromVdAttention } from "./vdAttentionFilter";

describe("isExcludedFromVdAttention", () => {
  it("excludes per-AO RATIO_PERCENT TARGET (Sjukfrånvaro)", () => {
    assert.equal(
      isExcludedFromVdAttention({
        kind: "TARGET",
        calcOperator: "RATIO_PERCENT",
      }),
      true,
    );
  });

  it("excludes per-AO month-to-date ratio TARGET", () => {
    assert.equal(
      isExcludedFromVdAttention({
        kind: "TARGET",
        calcOperator: "MONTH_TO_DATE_RATIO_PERCENT",
      }),
      true,
    );
  });

  it("keeps company WEIGHTED_RATIO_PERCENT TARGET (Sjukfrånvaro Alwex totalt)", () => {
    assert.equal(
      isExcludedFromVdAttention({
        kind: "TARGET",
        calcOperator: "WEIGHTED_RATIO_PERCENT",
      }),
      false,
    );
  });

  it("keeps system-computed SUM_DIVIDE TARGET for VD attention", () => {
    assert.equal(
      isExcludedFromVdAttention({
        kind: "TARGET",
        calcOperator: "SUM_DIVIDE",
      }),
      false,
    );
  });

  it("keeps ordinary TARGET KPIs without calc operator", () => {
    assert.equal(
      isExcludedFromVdAttention({
        kind: "TARGET",
        calcOperator: null,
      }),
      false,
    );
  });

  it("does not exclude STATISTIC / CALCULATED by this rule", () => {
    assert.equal(
      isExcludedFromVdAttention({
        kind: "STATISTIC",
        calcOperator: null,
      }),
      false,
    );
    assert.equal(
      isExcludedFromVdAttention({
        kind: "CALCULATED",
        calcOperator: "DIVIDE",
      }),
      false,
    );
  });
});
