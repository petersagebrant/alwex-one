import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commitDailyKpiDraft,
  committedRatioPercentPreview,
  computedDailyKpiDraftStatus,
  dailyKpiCommentRequired,
  dailyKpiDisplayStatus,
  dailyKpiHasCommittedValue,
  type DailyKpiDisplayDraft,
  type DailyKpiDisplayKpi,
} from "./dailyKpiDisplay";

const leverans: DailyKpiDisplayKpi = {
  status: "Grön",
  kind: "TARGET",
  direction: "HIGHER_IS_BETTER",
  toleranceType: "PERCENT",
  greenTolerance: null,
  yellowTolerance: 5,
  targetValue: "100",
};

const sjukfranvaro: DailyKpiDisplayKpi = {
  status: "Grön",
  kind: "TARGET",
  direction: "LOWER_IS_BETTER",
  toleranceType: "ABSOLUTE",
  greenTolerance: null,
  yellowTolerance: 1,
  targetValue: "5",
};

const sjuktimmar: DailyKpiDisplayKpi = {
  status: "Statistik",
  kind: "STATISTIC",
  direction: null,
  toleranceType: null,
  greenTolerance: null,
  yellowTolerance: null,
  targetValue: null,
};

function draft(
  overrides: Partial<DailyKpiDisplayDraft> = {},
): DailyKpiDisplayDraft {
  return {
    value: "",
    status: "Gul",
    comment: "",
    committedValue: "",
    ...overrides,
  };
}

describe("committed display vs live input", () => {
  it("does not treat an in-progress 9 as committed red while committed value is empty", () => {
    const live = draft({ value: "9", committedValue: "", status: "Gul" });
    assert.equal(dailyKpiHasCommittedValue(live), false);
    assert.equal(dailyKpiCommentRequired(leverans, live), false);
    assert.equal(dailyKpiDisplayStatus(leverans, live), "Gul");
    assert.equal(computedDailyKpiDraftStatus(leverans, live), "Röd");
  });

  it("opens Gul/Röd comment only after the typed value is committed", () => {
    const typing = draft({ value: "9", committedValue: "", status: "Grön" });
    assert.equal(dailyKpiCommentRequired(leverans, typing), false);

    const committed = commitDailyKpiDraft(leverans, typing);
    assert.equal(committed.committedValue, "9");
    assert.equal(committed.status, "Röd");
    assert.equal(dailyKpiHasCommittedValue(committed), true);
    assert.equal(dailyKpiCommentRequired(leverans, committed), true);
    assert.equal(dailyKpiDisplayStatus(leverans, committed), "Röd");
  });

  it("keeps the previous committed green badge while the user types 9 toward 100", () => {
    const typing = draft({
      value: "9",
      committedValue: "100",
      status: "Grön",
    });
    assert.equal(dailyKpiDisplayStatus(leverans, typing), "Grön");
    assert.equal(dailyKpiCommentRequired(leverans, typing), false);
    assert.equal(computedDailyKpiDraftStatus(leverans, typing), "Röd");
  });

  it("skips comment when the committed value is empty after blur", () => {
    const cleared = commitDailyKpiDraft(
      leverans,
      draft({ value: "  ", committedValue: "9", status: "Röd" }),
    );
    assert.equal(cleared.committedValue, "  ");
    assert.equal(dailyKpiHasCommittedValue(cleared), false);
    assert.equal(dailyKpiCommentRequired(leverans, cleared), false);
  });

  it("does not require a comment on statistic inputs", () => {
    const committed = commitDailyKpiDraft(
      sjuktimmar,
      draft({ value: "8", status: "Gul" }),
    );
    assert.equal(committed.status, "Gul");
    assert.equal(dailyKpiCommentRequired(sjuktimmar, committed), false);
  });
});

describe("committed ratio percent preview", () => {
  it("does not preview % or status until both operands are committed", () => {
    assert.deepEqual(
      committedRatioPercentPreview(sjukfranvaro, "8", ""),
      { value: null, status: null },
    );
    assert.deepEqual(
      committedRatioPercentPreview(sjukfranvaro, "", "100"),
      { value: null, status: null },
    );
  });

  it("computes % and status from the committed pair, not a live incomplete keystroke", () => {
    const saved = committedRatioPercentPreview(sjukfranvaro, "2", "100");
    assert.equal(saved.value, "2");
    assert.equal(saved.status, "Grön");

    const afterBlur = committedRatioPercentPreview(sjukfranvaro, "8", "100");
    assert.equal(afterBlur.value, "8");
    assert.equal(afterBlur.status, "Röd");
  });
});
