import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dailySteeringAttentionKpis } from "./attentionKpis";
import {
  PUBLIC_REPORT_CATEGORY_OPTIONS,
  filterDriftAttentionReports,
  parsePublicReportCategory,
} from "./category";
import { hashClientIp } from "./client-ip";
import { filterDailySteeringNotices } from "./notices";
import { draftDailySteeringSummary } from "./meetingSummary";
import {
  followUpReportSourceLabel,
  formatAttentionKpiTitle,
  isSteeringBoardStatusSelected,
  nextSteeringBoardStatus,
  STEERING_BOARD_STATUS_ACTIONS,
  steeringBoardStatusLabel,
} from "./boardPresentation";
import {
  OPERATIONAL_REPORT_STATUS_LABELS,
  OPERATIONAL_REPORT_STATUSES,
} from "../../types/operational-report";
import {
  filterEscalatedOpenActivities,
  filterOpenActivities,
  isOverdueActivity,
  sortOpenActivities,
} from "./openActivities";
import {
  canAnswerEscalation,
  canEscalateActivity,
  canReadActivityEscalation,
  canReadOperationalReport,
  canUpdateOperationalReportStatus,
  canViewLeadershipEscalations,
  canWriteOperationalForArea,
} from "./permissions";
import {
  countSafetyIncidentsForDay,
  formatSafetyIncidentLine,
} from "./safety";
import { sortOperationalReportsByPriority } from "./sort";
import {
  filterActiveMorningReports,
  isActiveMorningReport,
  statusAfterCreatingLinkedAction,
} from "./status";
import { parseOperationalReportForm } from "./validate";

const AREA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AREA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOTALT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260910140000_operational_reports.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ").toLowerCase();
const steeringMigration = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260910150000_daily_steering_board.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const steeringNormalized = steeringMigration.replace(/\s+/g, " ").toLowerCase();

describe("operational_reports migration", () => {
  it("creates the table, indexes, totalt trigger and resolved trigger", () => {
    assert.match(normalized, /create table public\.operational_reports/);
    assert.match(normalized, /priority in \('info', 'follow_up', 'urgent'\)/);
    assert.match(normalized, /status in \('ny', 'hanteras', 'klar'\)/);
    assert.match(
      normalized,
      /create index operational_reports_status_created_at_idx on public\.operational_reports \(status, created_at desc\)/,
    );
    assert.match(
      normalized,
      /create index operational_reports_business_area_status_idx on public\.operational_reports \(business_area_id, status\)/,
    );
    assert.match(normalized, /prevent_operational_report_on_totalt/);
    assert.match(normalized, /slug = 'alwex-totalt'/);
    assert.match(normalized, /sync_operational_report_resolved/);
    assert.match(normalized, /new\.resolved_by := coalesce\(new\.resolved_by, auth\.uid\(\)\)/);
  });

  it("gives anon insert-only and authenticated select/update, no delete", () => {
    assert.match(
      normalized,
      /create policy "anon: insert operational_reports" on public\.operational_reports for insert to anon/,
    );
    assert.match(
      normalized,
      /create policy "role: read operational_reports" on public\.operational_reports for select to authenticated using \(public\.can_read_business_area\(business_area_id\)\)/,
    );
    assert.match(
      normalized,
      /using \(public\.can_write_operational\(business_area_id\)\) with check \(public\.can_write_operational\(business_area_id\)\)/,
    );
    assert.match(normalized, /grant insert on table public\.operational_reports to anon/);
    assert.match(
      normalized,
      /grant select, update on table public\.operational_reports to authenticated/,
    );
    assert.doesNotMatch(normalized, /grant delete on table public\.operational_reports/);
    assert.doesNotMatch(normalized, /for delete/);
    assert.match(
      normalized,
      /grant execute on function public\.list_operational_report_areas\(\) to anon/,
    );
    assert.match(normalized, /consume_operational_report_rate_limit/);
  });
});

describe("operational report permissions", () => {
  it("lets vd update all, ao_chef own only, lasbehorighet none", () => {
    assert.equal(
      canUpdateOperationalReportStatus("vd", null, AREA_A),
      true,
    );
    assert.equal(
      canUpdateOperationalReportStatus("vice_vd", null, AREA_B),
      true,
    );
    assert.equal(
      canUpdateOperationalReportStatus("administrator", null, AREA_A),
      true,
    );
    assert.equal(
      canUpdateOperationalReportStatus("ao_chef", AREA_A, AREA_A),
      true,
    );
    assert.equal(
      canUpdateOperationalReportStatus("ao_chef", AREA_A, AREA_B),
      false,
    );
    assert.equal(
      canUpdateOperationalReportStatus("lasbehorighet", null, AREA_A),
      false,
    );
    assert.equal(canWriteOperationalForArea("vd", null, AREA_A), true);
    assert.equal(canWriteOperationalForArea("ao_chef", AREA_A, AREA_B), false);
    assert.equal(
      canWriteOperationalForArea("lasbehorighet", null, AREA_A),
      false,
    );
  });

  it("lets lasbehorighet read all and ao_chef only own area", () => {
    assert.equal(canReadOperationalReport("lasbehorighet", null, AREA_A), true);
    assert.equal(canReadOperationalReport("ao_chef", AREA_A, AREA_A), true);
    assert.equal(canReadOperationalReport("ao_chef", AREA_A, AREA_B), false);
    assert.equal(canReadOperationalReport("vd", null, AREA_B), true);
  });

  it("lets AO-chef escalate own area only and never answer", () => {
    assert.equal(canEscalateActivity("ao_chef", AREA_A, AREA_A), true);
    assert.equal(canEscalateActivity("ao_chef", AREA_A, AREA_B), false);
    assert.equal(canAnswerEscalation("ao_chef"), false);
    assert.equal(canViewLeadershipEscalations("ao_chef"), false);
    assert.equal(canReadActivityEscalation("ao_chef", AREA_A, AREA_A), true);
    assert.equal(canReadActivityEscalation("ao_chef", AREA_A, AREA_B), false);
  });

  it("lets VD and Vice VD see and answer all escalations", () => {
    assert.equal(canViewLeadershipEscalations("vd"), true);
    assert.equal(canViewLeadershipEscalations("vice_vd"), true);
    assert.equal(canAnswerEscalation("vd"), true);
    assert.equal(canAnswerEscalation("vice_vd"), true);
    assert.equal(canEscalateActivity("vd", null, AREA_B), true);
    assert.equal(canReadActivityEscalation("vd", null, AREA_B), true);
    assert.equal(canReadActivityEscalation("vice_vd", null, AREA_A), true);
    assert.equal(canViewLeadershipEscalations("administrator"), false);
    assert.equal(canAnswerEscalation("administrator"), true);
    assert.equal(canViewLeadershipEscalations("lasbehorighet"), false);
    assert.equal(canAnswerEscalation("lasbehorighet"), false);
  });
});

describe("report vs activity status isolation", () => {
  it("labels report close as Stäng rapport and keeps activity Klar", () => {
    assert.deepEqual([...OPERATIONAL_REPORT_STATUSES], ["ny", "hanteras", "klar"]);
    assert.deepEqual(OPERATIONAL_REPORT_STATUS_LABELS, {
      ny: "Ny",
      hanteras: "Hanteras",
      klar: "Stäng rapport",
    });
    assert.deepEqual(
      STEERING_BOARD_STATUS_ACTIONS.map((item) => item.label),
      ["Öppen", "Pågår", "Klar"],
    );
    assert.deepEqual(
      STEERING_BOARD_STATUS_ACTIONS.map((item) => item.value),
      ["Ej påbörjad", "Pågår", "Klar"],
    );
  });

  it("closes a report without mutating a linked activity", () => {
    const action = sliceExport(
      readFileSync(
        fileURLToPath(new URL("../../app/daglig-styrning/actions.ts", import.meta.url)),
        "utf8",
      ),
      "updateOperationalReportStatusAction",
    );
    const service = sliceExport(
      readFileSync(
        fileURLToPath(new URL("../../services/operationalReports.ts", import.meta.url)),
        "utf8",
      ),
      "updateOperationalReportStatus",
    );
    const row = sliceExport(
      readFileSync(
        fileURLToPath(
          new URL("../../lib/supabase/operational-reports.ts", import.meta.url),
        ),
        "utf8",
      ),
      "updateOperationalReportStatusRow",
    );

    assert.match(action, /updateOperationalReportStatus\(/);
    assert.doesNotMatch(action, /patchSteeringActivity/);
    assert.doesNotMatch(action, /createSteeringActivity/);
    assert.doesNotMatch(action, /from\("activities"\)/);

    assert.match(service, /updateOperationalReportStatusRow\(/);
    assert.doesNotMatch(service, /activities/);
    assert.doesNotMatch(service, /patchSteeringActivity/);

    assert.match(row, /\.from\("operational_reports"\)/);
    assert.match(row, /\.update\(\{ status \}\)/);
    assert.doesNotMatch(row, /activities/);
  });

  it("completes an activity without mutating the linked report", () => {
    const action = sliceExport(
      readFileSync(
        fileURLToPath(new URL("../../app/daglig-styrning/actions.ts", import.meta.url)),
        "utf8",
      ),
      "patchSteeringActivityAction",
    );
    const service = sliceExport(
      readFileSync(
        fileURLToPath(new URL("../../services/activities.ts", import.meta.url)),
        "utf8",
      ),
      "patchSteeringActivity",
    );
    const rowType = sliceExport(
      readFileSync(
        fileURLToPath(new URL("../../lib/supabase/activities.ts", import.meta.url)),
        "utf8",
      ),
      "UpdateActivitySteeringRowInput",
    );
    const row = sliceExport(
      readFileSync(
        fileURLToPath(new URL("../../lib/supabase/activities.ts", import.meta.url)),
        "utf8",
      ),
      "updateActivitySteeringRow",
    );

    assert.match(action, /intent === "status"/);
    assert.match(action, /patchSteeringActivity\(\{\s*id,\s*status\s*\}/);
    assert.doesNotMatch(action, /updateOperationalReportStatus/);
    assert.doesNotMatch(action, /from\("operational_reports"\)/);

    assert.match(service, /updateActivitySteeringRow\(/);
    assert.doesNotMatch(service, /operational_reports/);
    assert.doesNotMatch(service, /updateOperationalReportStatus/);

    assert.doesNotMatch(rowType, /operational_report/);
    assert.match(row, /\.from\("activities"\)/);
    assert.doesNotMatch(row, /operational_reports/);
  });
});

describe("operational report status and sort", () => {
  it("keeps klar out of the active morning list", () => {
    assert.equal(isActiveMorningReport("ny"), true);
    assert.equal(isActiveMorningReport("hanteras"), true);
    assert.equal(isActiveMorningReport("klar"), false);
    const filtered = filterActiveMorningReports([
      { status: "ny" as const },
      { status: "hanteras" as const },
      { status: "klar" as const },
    ]);
    assert.deepEqual(
      filtered.map((item) => item.status),
      ["ny", "hanteras"],
    );
    assert.equal(statusAfterCreatingLinkedAction("ny"), "hanteras");
    assert.equal(statusAfterCreatingLinkedAction("hanteras"), "hanteras");
    assert.equal(statusAfterCreatingLinkedAction("klar"), "klar");
  });

  it("hides a report from incoming once any activity is linked, without deleting it", () => {
    const reports = [
      { id: "rep-open", status: "ny" as const },
      { id: "rep-linked", status: "hanteras" as const },
      { id: "rep-other", status: "ny" as const },
      { id: "rep-closed", status: "klar" as const },
    ];
    const incoming = filterActiveMorningReports(reports, {
      linkedReportIds: ["rep-linked", null, ""],
    });
    assert.deepEqual(
      incoming.map((row) => row.id),
      ["rep-open", "rep-other"],
    );
    assert.equal(
      reports.find((row) => row.id === "rep-linked")?.status,
      "hanteras",
    );
    assert.equal(reports.length, 4);
  });

  it("keeps the FK when creating an action and then drops the source from incoming", () => {
    const unlinked = {
      id: "rep-new",
      status: "ny" as "ny" | "hanteras" | "klar",
      body: "Ny avvikelse",
    };
    const report = {
      id: "rep-1",
      status: "ny" as "ny" | "hanteras" | "klar",
      body: "Lastbil stannade",
    };
    const storedReports = [{ ...unlinked }, { ...report }];
    const createdActivity = {
      id: "act-1",
      status: "Ej påbörjad" as const,
      operationalReportId: report.id,
    };
    const nextStatus = statusAfterCreatingLinkedAction(report.status);
    storedReports[1] = { ...report, status: nextStatus };

    const incoming = filterActiveMorningReports(storedReports, {
      linkedReportIds: [createdActivity.operationalReportId],
    });
    const followUp = filterOpenActivities([createdActivity]);

    assert.equal(createdActivity.operationalReportId, "rep-1");
    assert.equal(nextStatus, "hanteras");
    assert.notEqual(nextStatus, "klar");
    assert.deepEqual(
      incoming.map((row) => row.id),
      ["rep-new"],
    );
    assert.deepEqual(
      followUp.map((row) => row.id),
      ["act-1"],
    );
    assert.equal(storedReports[1]?.id, "rep-1");
    assert.equal(storedReports[1]?.body, "Lastbil stannade");
    assert.equal(storedReports[1]?.status, "hanteras");
  });

  it("still hides linked reports from incoming when escalation history cannot load", () => {
    const reports = [
      { id: "rep-open", status: "ny" as const },
      { id: "rep-linked", status: "hanteras" as const },
    ];
    const activities = [
      {
        id: "act-1",
        operationalReportId: "rep-linked",
        escalations: [],
      },
    ];
    const incoming = filterActiveMorningReports(reports, {
      linkedReportIds: activities.map((activity) => activity.operationalReportId),
    });

    assert.equal(activities.length, 1);
    assert.deepEqual(activities[0]?.escalations, []);
    assert.deepEqual(
      incoming.map((row) => row.id),
      ["rep-open"],
    );
  });

  it("sorts urgent before follow_up before info", () => {
    const sorted = sortOperationalReportsByPriority([
      { priority: "info", createdAt: "2026-09-10T10:00:00Z" },
      { priority: "urgent", createdAt: "2026-09-10T08:00:00Z" },
      { priority: "follow_up", createdAt: "2026-09-10T09:00:00Z" },
    ]);
    assert.deepEqual(
      sorted.map((item) => item.priority),
      ["urgent", "follow_up", "info"],
    );
  });
});

describe("operational report validation", () => {
  const allowed = new Set([AREA_A]);

  it("rejects empty body, invalid AO and totalt", () => {
    assert.equal(
      parseOperationalReportForm(
        {
          haulierName: "Åkeri",
          businessAreaId: AREA_A,
          body: "",
          priority: "info",
          category: "ovrigt",
          honeypot: "",
        },
        allowed,
      ).ok,
      false,
    );
    assert.equal(
      parseOperationalReportForm(
        {
          haulierName: "Åkeri",
          businessAreaId: AREA_B,
          body: "Hända",
          priority: "info",
          category: "ovrigt",
          honeypot: "",
        },
        allowed,
      ).ok,
      false,
    );
    assert.equal(
      parseOperationalReportForm(
        {
          haulierName: "Åkeri",
          businessAreaId: TOTALT,
          body: "Hända",
          priority: "urgent",
          category: "ovrigt",
          honeypot: "",
        },
        allowed,
      ).ok,
      false,
    );
  });

  it("treats a filled honeypot as discard", () => {
    const result = parseOperationalReportForm(
      {
        haulierName: "Åkeri",
        businessAreaId: AREA_A,
        body: "Hända",
        priority: "info",
        category: "ovrigt",
        honeypot: "http://spam.example",
      },
      allowed,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "honeypot");
    }
  });

  it("accepts a valid public report", () => {
    const result = parseOperationalReportForm(
      {
        haulierName: "Åkeri AB",
        businessAreaId: AREA_A,
        body: "Lastbil stannade",
        priority: "urgent",
        category: "sakerhet",
        honeypot: "",
      },
      allowed,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.category, "sakerhet");
      assert.equal(result.value.incidentKind, "tillbud");
    }
  });

  it("rejects a missing category", () => {
    const result = parseOperationalReportForm(
      {
        haulierName: "Åkeri AB",
        businessAreaId: AREA_A,
        body: "Lastbil stannade",
        priority: "info",
        category: "",
        honeypot: "",
      },
      allowed,
    );
    assert.equal(result.ok, false);
  });
});

describe("daily steering KPI presentation", () => {
  it("uses classifyDashboardTargetKpis and lists red before yellow", () => {
    const rows = dailySteeringAttentionKpis([
      {
        id: "yellow-1",
        name: "Gul KPI",
        businessAreaId: AREA_A,
        businessAreaName: "Fjärr",
        kind: "TARGET",
        status: "Gul",
        currentValue: "4",
        targetValue: "6",
        unit: "st",
      },
      {
        id: "red-1",
        name: "Röd KPI",
        businessAreaId: AREA_B,
        businessAreaName: "Lager",
        kind: "TARGET",
        status: "Röd",
        currentValue: "1",
        targetValue: "8",
        unit: "st",
      },
      {
        id: "green-1",
        name: "Grön KPI",
        businessAreaId: AREA_B,
        businessAreaName: "Lager",
        kind: "TARGET",
        status: "Grön",
        currentValue: "9",
        targetValue: "8",
        unit: "st",
      },
    ]);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["red-1", "yellow-1"],
    );
    assert.equal(rows[0]?.status, "Röd");
    assert.equal(rows[0]?.href, "/kpis/red-1");
    assert.equal(rows[0]?.businessAreaId, AREA_B);
    assert.match(rows[0]?.valueLabel ?? "", /mot mål/);
    assert.equal(rows[0]?.titleLabel, "🔴 Lager – Röd KPI");
    assert.equal(rows[1]?.titleLabel, "🟡 Fjärr – Gul KPI");
  });
});

describe("daily steering compact presentation", () => {
  it("formats KPI titles and maps activity status to Öppen/Pågår/Klar", () => {
    assert.equal(
      formatAttentionKpiTitle({
        businessAreaName: "Kyl & Frys",
        name: "Fyllnadsgrad",
        status: "Gul",
      }),
      "🟡 Kyl & Frys – Fyllnadsgrad",
    );
    assert.equal(steeringBoardStatusLabel("Ej påbörjad"), "Öppen");
    assert.equal(steeringBoardStatusLabel("Försenad"), "Öppen");
    assert.equal(steeringBoardStatusLabel("Pågår"), "Pågår");
    assert.equal(steeringBoardStatusLabel("Klar"), "Klar");
    assert.equal(isSteeringBoardStatusSelected("Försenad", "Ej påbörjad"), true);
    assert.equal(isSteeringBoardStatusSelected("Pågår", "Ej påbörjad"), false);
    assert.deepEqual(nextSteeringBoardStatus("Ej påbörjad"), {
      value: "Pågår",
      label: "Starta",
    });
    assert.deepEqual(nextSteeringBoardStatus("Försenad"), {
      value: "Pågår",
      label: "Starta",
    });
    assert.deepEqual(nextSteeringBoardStatus("Pågår"), {
      value: "Klar",
      label: "Klar",
    });
    assert.equal(nextSteeringBoardStatus("Klar"), null);
    assert.equal(
      followUpReportSourceLabel({
        operationalReportId: "rep-1",
        haulierName: "Åkeri AB",
      }),
      "Från rapport · Åkeri AB",
    );
    assert.equal(
      followUpReportSourceLabel({ operationalReportId: "rep-1" }),
      "Från rapport",
    );
    assert.equal(followUpReportSourceLabel({ operationalReportId: null }), null);
  });
});

describe("daily steering notices", () => {
  it("keeps Driftstörning, Viktigt and org-wide", () => {
    const filtered = filterDailySteeringNotices([
      { kind: "Driftstörning" as const, businessAreaId: AREA_A },
      { kind: "Information" as const, businessAreaId: AREA_A },
      { kind: "Information" as const, businessAreaId: null },
      { kind: "Behov" as const, businessAreaId: AREA_A },
      { kind: "Viktigt" as const, businessAreaId: AREA_B },
    ]);
    assert.deepEqual(
      filtered.map((item) => item.kind),
      ["Driftstörning", "Information", "Viktigt"],
    );
  });
});

describe("client IP hash", () => {
  it("hashes IP instead of storing it raw", () => {
    const hashed = hashClientIp("203.0.113.10");
    assert.equal(hashed.includes("203.0.113.10"), false);
    assert.equal(hashed.length, 64);
  });
});

describe("daily steering board migration", () => {
  it("extends activities and reports instead of creating a parallel actions table", () => {
    assert.match(steeringNormalized, /alter table public\.operational_reports/);
    assert.match(
      steeringNormalized,
      /category in \('sakerhet', 'drift', 'ovrigt'\)/,
    );
    assert.match(steeringNormalized, /alter table public\.activities/);
    assert.match(steeringNormalized, /operational_report_id uuid/);
    assert.match(steeringNormalized, /requires_escalation boolean not null default false/);
    assert.doesNotMatch(steeringNormalized, /create table public\.\w*action/);
    assert.doesNotMatch(steeringNormalized, /create table public\.steering_/);
  });
});

describe("activity escalation history migration", () => {
  it("adds activity_escalations with area-scoped RLS and VD-only answers", () => {
    const extra = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/20260910200000_activity_escalations.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    )
      .replace(/\s+/g, " ")
      .toLowerCase();
    assert.match(extra, /create table public\.activity_escalations/);
    assert.match(extra, /question text not null/);
    assert.match(extra, /asked_by uuid/);
    assert.match(extra, /asked_by_name text not null/);
    assert.match(extra, /reply text null/);
    assert.match(extra, /replied_by uuid/);
    assert.match(extra, /status text not null default 'open'/);
    assert.match(extra, /activity_escalations_one_open_per_activity/);
    assert.match(extra, /can_read_business_area\(a\.business_area_id\)/);
    assert.match(extra, /can_write_operational\(a\.business_area_id\)/);
    assert.match(extra, /public\.is_vd_equivalent\(\)/);
    assert.match(extra, /array\['administrator'\]/);
    assert.doesNotMatch(extra, /for delete/);
  });
});

describe("daily steering owner and escalation note migration", () => {
  it("adds owner_id and escalation_note on activities, not a new table", () => {
    const extra = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/20260910160000_steering_owner_escalation_note.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    )
      .replace(/\s+/g, " ")
      .toLowerCase();
    assert.match(extra, /alter table public\.activities/);
    assert.match(
      extra,
      /owner_id uuid references public\.profiles \(id\) on delete set null/,
    );
    assert.match(extra, /escalation_note text null/);
    assert.doesNotMatch(extra, /create table/);
  });
});

describe("public report category mapping", () => {
  it("exposes three public options and maps them to existing enums", () => {
    assert.deepEqual(
      PUBLIC_REPORT_CATEGORY_OPTIONS.map((option) => option.value),
      ["sakerhet", "drift", "ovrigt"],
    );
    assert.deepEqual(
      PUBLIC_REPORT_CATEGORY_OPTIONS.map((option) => option.label),
      ["Säkerhet / tillbud", "Drift / leverans", "Övrigt"],
    );
    assert.deepEqual(parsePublicReportCategory("sakerhet"), {
      category: "sakerhet",
      incidentKind: "tillbud",
    });
    assert.deepEqual(parsePublicReportCategory("drift"), {
      category: "drift",
      incidentKind: null,
    });
    assert.deepEqual(parsePublicReportCategory("ovrigt"), {
      category: "ovrigt",
      incidentKind: null,
    });
  });
});

describe("safety and drift classification", () => {
  it("counts today's safety kinds and ignores other days", () => {
    const counts = countSafetyIncidentsForDay(
      [
        {
          category: "sakerhet" as const,
          incidentKind: "tillbud" as const,
          createdAt: "2026-09-10T07:00:00+02:00",
          status: "ny" as const,
        },
        {
          category: "sakerhet" as const,
          incidentKind: "olycka" as const,
          createdAt: "2026-09-09T07:00:00+02:00",
          status: "ny" as const,
        },
        {
          category: "drift" as const,
          incidentKind: null,
          createdAt: "2026-09-10T08:00:00+02:00",
          status: "ny" as const,
        },
        {
          category: "sakerhet" as const,
          incidentKind: "allvarlig_risk" as const,
          createdAt: "2026-09-10T09:00:00+02:00",
          status: "hanteras" as const,
        },
      ],
      "2026-09-10",
    );
    assert.deepEqual(counts, {
      olyckor: 0,
      tillbud: 1,
      allvarligaRisker: 1,
    });
    assert.equal(
      formatSafetyIncidentLine(counts),
      "0 olyckor | 1 tillbud | 1 allvarliga risker",
    );
  });

  it("does not count klar safety reports on the morning board", () => {
    const counts = countSafetyIncidentsForDay(
      [
        {
          category: "sakerhet" as const,
          incidentKind: "olycka" as const,
          createdAt: "2026-09-10T07:00:00+02:00",
          status: "klar" as const,
        },
        {
          category: "sakerhet" as const,
          incidentKind: "tillbud" as const,
          createdAt: "2026-09-10T08:00:00+02:00",
          status: "hanteras" as const,
        },
      ],
      "2026-09-10",
    );
    assert.deepEqual(counts, {
      olyckor: 0,
      tillbud: 1,
      allvarligaRisker: 0,
    });
  });

  it("keeps only open urgent/follow_up drift in drift today", () => {
    const filtered = filterDriftAttentionReports([
      {
        category: "drift" as const,
        priority: "urgent" as const,
        status: "ny" as const,
      },
      {
        category: "drift" as const,
        priority: "info" as const,
        status: "ny" as const,
      },
      {
        category: "sakerhet" as const,
        priority: "urgent" as const,
        status: "ny" as const,
      },
      {
        category: "drift" as const,
        priority: "follow_up" as const,
        status: "klar" as const,
      },
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.priority, "urgent");
  });
});

describe("open activities reuse", () => {
  it("hides klar, highlights overdue, and lists escalation separately", () => {
    const rows = [
      {
        id: "1",
        status: "Pågår" as const,
        deadline: "2026-09-09",
        createdAt: "2026-09-08T10:00:00Z",
        requiresEscalation: false,
        escalatedAt: null,
      },
      {
        id: "2",
        status: "Klar" as const,
        deadline: "2026-09-09",
        createdAt: "2026-09-07T10:00:00Z",
        requiresEscalation: true,
        escalatedAt: "2026-09-08T10:00:00Z",
      },
      {
        id: "3",
        status: "Ej påbörjad" as const,
        deadline: "2026-09-12",
        createdAt: "2026-09-10T10:00:00Z",
        requiresEscalation: true,
        escalatedAt: "2026-09-10T11:00:00Z",
      },
    ];
    const open = filterOpenActivities(rows);
    assert.deepEqual(
      open.map((row) => row.id),
      ["1", "3"],
    );
    assert.equal(isOverdueActivity(rows[0]!, "2026-09-10"), true);
    assert.equal(isOverdueActivity(rows[2]!, "2026-09-10"), false);
    assert.deepEqual(
      filterEscalatedOpenActivities(rows).map((row) => row.id),
      ["3"],
    );
    assert.deepEqual(
      sortOpenActivities(open, "2026-09-10").map((row) => row.id),
      ["1", "3"],
    );
  });

  it("drops answered escalation from Eskalerat without closing the action", () => {
    const answered = {
      id: "open-escalation",
      status: "Pågår" as const,
      deadline: "2026-09-12",
      createdAt: "2026-09-10T10:00:00Z",
      requiresEscalation: false,
      escalatedAt: "2026-09-10T11:00:00Z",
    };
    assert.deepEqual(
      filterOpenActivities([answered]).map((row) => row.id),
      ["open-escalation"],
    );
    assert.deepEqual(filterEscalatedOpenActivities([answered]), []);
    assert.equal(answered.status, "Pågår");
  });
});

describe("morning board workflow helpers", () => {
  it("covers ny → action → hanteras → escalate → besvarad → klar leaves active views", () => {
    const reportStatus = statusAfterCreatingLinkedAction("ny");
    assert.equal(reportStatus, "hanteras");
    const afterSecondAction = statusAfterCreatingLinkedAction(reportStatus);
    assert.equal(afterSecondAction, "hanteras");

    const escalated = {
      id: "act-1",
      status: "Pågår" as const,
      deadline: "2026-09-12",
      createdAt: "2026-09-10T10:00:00Z",
      requiresEscalation: true,
      escalatedAt: "2026-09-10T11:00:00Z",
    };
    assert.deepEqual(
      filterEscalatedOpenActivities([escalated]).map((row) => row.id),
      ["act-1"],
    );

    const answered = { ...escalated, requiresEscalation: false };
    assert.deepEqual(filterEscalatedOpenActivities([answered]), []);
    assert.deepEqual(
      filterOpenActivities([answered]).map((row) => row.id),
      ["act-1"],
    );
    assert.equal(answered.status, "Pågår");

    const reports = [
      {
        status: "klar" as const,
        category: "sakerhet" as const,
        incidentKind: "tillbud" as const,
        createdAt: "2026-09-10T07:00:00+02:00",
        priority: "urgent" as const,
      },
      {
        status: "hanteras" as const,
        category: "drift" as const,
        incidentKind: null,
        createdAt: "2026-09-10T08:00:00+02:00",
        priority: "follow_up" as const,
      },
    ];
    assert.deepEqual(
      filterActiveMorningReports(reports).map((row) => row.status),
      ["hanteras"],
    );
    assert.equal(filterDriftAttentionReports(reports).length, 1);
    assert.deepEqual(
      countSafetyIncidentsForDay(reports, "2026-09-10"),
      { olyckor: 0, tillbud: 0, allvarligaRisker: 0 },
    );
  });
});

describe("meeting summary hook", () => {
  it("drafts a compact line without requiring a new table", () => {
    const draft = draftDailySteeringSummary({
      safetyCount: 1,
      driftCount: 2,
      incomingCount: 3,
      attentionKpiCount: 4,
      openActionCount: 2,
      overdueActionCount: 1,
      escalationCount: 1,
    });
    assert.match(draft.line, /åtgärder/);
    assert.match(draft.line, /eskalering/);
  });
});
