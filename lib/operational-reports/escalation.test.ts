import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  activityStaysOpenAfterAnswer,
  appendEscalationHistory,
  canStartNewEscalation,
  filterOpenLeadershipEscalations,
  requiresEscalationFromHistory,
  sortEscalationHistory,
} from "./escalation";
import {
  filterEscalatedOpenActivities,
  filterOpenActivities,
} from "./openActivities";

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

type HistoryRow = {
  id: string;
  question: string;
  askedAt: string;
  reply: string | null;
  repliedByName: string | null;
  status: "open" | "answered";
};

const first: HistoryRow = {
  id: "esc-1",
  question: "Behöver beslut om extra bil",
  askedAt: "2026-09-10T08:00:00Z",
  reply: "Ta in extra bil imorgon",
  repliedByName: "Anna VD",
  status: "answered",
};

const second: HistoryRow = {
  id: "esc-2",
  question: "Ny fråga om helgbemanning",
  askedAt: "2026-09-10T12:00:00Z",
  reply: null,
  repliedByName: null,
  status: "open",
};

describe("escalation history helpers", () => {
  it("saves question and answer without overwriting earlier Q&A", () => {
    const history = appendEscalationHistory([first], second);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.question, "Behöver beslut om extra bil");
    assert.equal(history[0]?.reply, "Ta in extra bil imorgon");
    assert.equal(history[1]?.question, "Ny fråga om helgbemanning");
    assert.equal(history[0]?.question, first.question);
  });

  it("drops answered escalations from the VD open list", () => {
    assert.deepEqual(
      filterOpenLeadershipEscalations([first, second]).map((item) => item.id),
      ["esc-2"],
    );
    assert.deepEqual(filterOpenLeadershipEscalations([first]), []);
  });

  it("keeps the action in Att följa upp and does not mark it Klar", () => {
    const answered = activityStaysOpenAfterAnswer({
      id: "act-1",
      status: "Pågår" as const,
      deadline: "2026-09-12",
      createdAt: "2026-09-10T10:00:00Z",
      requiresEscalation: true,
    });
    assert.equal(answered.requiresEscalation, false);
    assert.equal(answered.status, "Pågår");
    assert.deepEqual(
      filterOpenActivities([answered]).map((row) => row.id),
      ["act-1"],
    );
    assert.deepEqual(filterEscalatedOpenActivities([answered]), []);
    assert.notEqual(answered.status, "Klar");
  });

  it("allows a new escalation after the previous one is answered", () => {
    assert.equal(canStartNewEscalation([first]), true);
    assert.equal(canStartNewEscalation([first, second]), false);
    assert.equal(requiresEscalationFromHistory([first, second]), true);
    assert.deepEqual(
      sortEscalationHistory([second, first]).map((item) => item.id),
      ["esc-1", "esc-2"],
    );
  });
});

describe("escalation wiring", () => {
  it("places the VD panel under briefing and before Aktuellt", () => {
    const vdDash = read("../../components/dashboard/VdLeadershipDashboard.tsx");
    const notices = read("../../components/dashboard/OrgNoticesFeed.tsx");
    const briefingIdx = vdDash.indexOf("<VdBriefingPanel");
    const escalationIdx = vdDash.indexOf("<LeadershipEscalationsSection");
    const orgFeedIdx = vdDash.indexOf("<OrgNoticesFeed");
    assert.ok(briefingIdx >= 0);
    assert.ok(escalationIdx > briefingIdx);
    assert.ok(orgFeedIdx > escalationIdx);
    assert.match(notices, /Aktuellt i verksamheten/);
  });

  it("records asked_by on escalate and reply fields on answer", () => {
    const service = read("../../services/activityEscalations.ts");
    const actions = read("../../app/daglig-styrning/actions.ts");
    const history = read(
      "../../components/daglig-styrning/ActivityEscalationHistory.tsx",
    );
    const reply = read(
      "../../components/dashboard/LeadershipEscalationReply.tsx",
    );
    const section = read(
      "../../components/dashboard/LeadershipEscalationsSection.tsx",
    );
    const create = read(
      "../../components/daglig-styrning/CreateLinkedActionControls.tsx",
    );

    assert.match(service, /asked_by: profile\.id/);
    assert.match(service, /asked_by_name/);
    assert.match(service, /insertActivityEscalation/);
    assert.match(service, /canEscalateActivity/);
    assert.match(service, /canAnswerEscalation/);
    assert.match(service, /canViewLeadershipEscalations/);
    assert.match(service, /replied_by: profile\.id/);
    assert.match(service, /status: "answered"/);
    assert.match(service, /requires_escalation: false/);
    assert.doesNotMatch(service, /status: "Klar"/);
    assert.match(actions, /recordActivityEscalation/);
    assert.match(actions, /answerActivityEscalation/);
    assert.match(history, /Eskalerat av/);
    assert.match(history, /Besvarat av/);
    assert.match(history, /Beslut\/svar:/);
    assert.match(history, /formatDateTimeSv\(item\.askedAt\)/);
    assert.match(history, /formatDateTimeSv\(item\.repliedAt\)/);
    assert.match(reply, /Beslut \/ svar/);
    assert.match(reply, /Spara svar/);
    assert.match(reply, /Avbryt/);
    assert.match(reply, /Besvara/);
    assert.match(reply, /answerEscalationAction/);
    assert.match(section, /Från Daglig styrning – kräver ditt beslut/);
    assert.match(section, /if \(items\.length === 0\)/);
    assert.match(section, /border-l-amber-500/);
    assert.doesNotMatch(section, /Eskalerat till ledningen/);
    assert.match(create, /requiresEscalation" value="1"/);
    assert.match(create, /escalationNote/);
  });
});
