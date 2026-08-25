import { parseKpiCalcOperator } from "@/lib/kpi/calculated";
import { computeKpiStatus } from "@/lib/kpi/computeStatus";
import {
  isDailyManualReportableKpi,
  isStatusTone,
  isSystemComputedKpi,
  parseKpiKind,
  parseKpiRatioReportingMode,
  parseKpiReportingFrequency,
  type KpiCalcOperator,
  type KpiKind,
  type KpiRatioReportingMode,
  type KpiReportingFrequency,
  type KpiStoredStatus,
} from "@/lib/kpi/kind";
import {
  collectRatioGroupMemberIds,
  findRatioPercentGroups,
} from "@/lib/kpi/ratioGroup";
import type { StatusTone } from "@/types";

export const EMPTY_DAILY_BATCH_MESSAGE = "Inget att spara.";

export type DailyKpiValidationKpi = {
  id: string;
  name: string;
  businessAreaId: string;
  archivedAt: string | null;
  kind: KpiKind;
  calcOperator: KpiCalcOperator | null;
  reportingFrequency: KpiReportingFrequency;
  direction: string | null;
  toleranceType: string | null;
  greenTolerance: number | string | null;
  yellowTolerance: number | string | null;
  targetValue: string | null;
  calcNumeratorKpiId: string | null;
  calcDenominatorKpiId: string | null;
  ratioReportingMode: KpiRatioReportingMode;
};

export type DailyReportDraft = {
  kpiId: string;
  value: string;
  status: string;
  comment?: string;
};

export type PreparedDailyKpiReport = {
  kpiId: string;
  reportDate: string;
  value: string;
  status: KpiStoredStatus;
  comment: string | undefined;
};

type DailyKpiResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Empty / whitespace-only → skip (Ej rapporterad). `"0"` / `"0,0"` are filled. */
export function isSkippedDailyReportValue(
  value: string | null | undefined,
): boolean {
  return (value ?? "").trim() === "";
}

/**
 * Latest kpi_history row with report_date < selected date.
 * Ignores later dates (backdating) and rows without report_date.
 */
export function selectPreviousDailyHistoryEntry<
  T extends { reportDate?: string | null },
>(history: T[], reportDate: string): T | null {
  let previous: T | null = null;
  for (const entry of history) {
    const entryDate = entry.reportDate;
    if (entryDate == null || entryDate >= reportDate) {
      continue;
    }
    if (previous == null || (previous.reportDate ?? "") < entryDate) {
      previous = entry;
    }
  }
  return previous;
}

export function dailyKpiValidationKpiFromRow(row: {
  id: string;
  name: string;
  business_area_id: string;
  archived_at: string | null;
  kpi_kind: string | null;
  calc_operator: string | null;
  reporting_frequency: string | null;
  direction: string | null;
  tolerance_type: string | null;
  green_tolerance: number | string | null;
  yellow_tolerance: number | string | null;
  target_value: string | null;
  calc_numerator_kpi_id: string | null;
  calc_denominator_kpi_id: string | null;
  ratio_reporting_mode: string | null;
}): DailyKpiValidationKpi {
  return {
    id: row.id,
    name: row.name,
    businessAreaId: row.business_area_id,
    archivedAt: row.archived_at,
    kind: parseKpiKind(row.kpi_kind),
    calcOperator: parseKpiCalcOperator(row.calc_operator),
    reportingFrequency: parseKpiReportingFrequency(row.reporting_frequency),
    direction: row.direction,
    toleranceType: row.tolerance_type,
    greenTolerance: row.green_tolerance,
    yellowTolerance: row.yellow_tolerance,
    targetValue: row.target_value,
    calcNumeratorKpiId: row.calc_numerator_kpi_id,
    calcDenominatorKpiId: row.calc_denominator_kpi_id,
    ratioReportingMode: parseKpiRatioReportingMode(row.ratio_reporting_mode),
  };
}

export function dailyKpiValidationKpiFromKpi(kpi: {
  id: string;
  name: string;
  businessAreaId: string;
  archivedAt?: string | null;
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
  reportingFrequency?: KpiReportingFrequency | null;
  direction?: string | null;
  toleranceType?: string | null;
  greenTolerance?: number | string | null;
  yellowTolerance?: number | string | null;
  targetValue?: string | null;
  calcNumeratorKpiId?: string | null;
  calcDenominatorKpiId?: string | null;
  ratioReportingMode?: KpiRatioReportingMode | null;
}): DailyKpiValidationKpi {
  return {
    id: kpi.id,
    name: kpi.name,
    businessAreaId: kpi.businessAreaId,
    archivedAt: kpi.archivedAt ?? null,
    kind: kpi.kind,
    calcOperator: kpi.calcOperator ?? null,
    reportingFrequency: parseKpiReportingFrequency(kpi.reportingFrequency),
    direction: kpi.direction ?? null,
    toleranceType: kpi.toleranceType ?? null,
    greenTolerance: kpi.greenTolerance ?? null,
    yellowTolerance: kpi.yellowTolerance ?? null,
    targetValue: kpi.targetValue ?? null,
    calcNumeratorKpiId: kpi.calcNumeratorKpiId ?? null,
    calcDenominatorKpiId: kpi.calcDenominatorKpiId ?? null,
    ratioReportingMode: parseKpiRatioReportingMode(kpi.ratioReportingMode),
  };
}

export function authorizeDailyKpiReport(
  profile: { role: string; businessAreaId: string | null },
  kpi: Pick<DailyKpiValidationKpi, "businessAreaId">,
): { ok: true } | { ok: false; error: string } {
  if (profile.role === "ao_chef") {
    if (!profile.businessAreaId) {
      return { ok: false, error: "Inget affärsområde är kopplat till ditt konto." };
    }
    if (kpi.businessAreaId !== profile.businessAreaId) {
      return {
        ok: false,
        error: "Du kan bara rapportera KPI:er för ditt eget affärsområde.",
      };
    }
    return { ok: true };
  }
  if (profile.role !== "vd" && profile.role !== "administrator") {
    return { ok: false, error: "Du saknar behörighet att rapportera KPI." };
  }
  return { ok: true };
}

/**
 * Shared daily-report validation used by single-KPI and batch save.
 * Caller must already reject empty values for the single-KPI action.
 */
export function prepareDailyKpiReport(
  kpi: DailyKpiValidationKpi,
  input: {
    value: string;
    status: string;
    comment?: string;
    reportDate: string;
  },
): DailyKpiResult<PreparedDailyKpiReport> {
  const value = input.value.trim();
  if (!value) {
    return { ok: false, error: "Ange ett värde." };
  }

  if (kpi.archivedAt) {
    return {
      ok: false,
      error: "Arkiverade KPI:er kan inte rapporteras. Återaktivera först.",
    };
  }

  if (kpi.kind === "CALCULATED" || kpi.calcOperator || isSystemComputedKpi(kpi)) {
    return {
      ok: false,
      error: "Beräknade KPI:er rapporteras inte manuellt.",
    };
  }

  if (kpi.reportingFrequency === "MONTHLY") {
    return {
      ok: false,
      error: "Månads-KPI:er rapporteras i månadsvyn, inte som daglig rapport.",
    };
  }

  if (kpi.kind === "STATISTIC") {
    return {
      ok: true,
      value: {
        kpiId: kpi.id,
        reportDate: input.reportDate,
        value,
        status: "Statistik",
        comment: input.comment?.trim() || undefined,
      },
    };
  }

  const computedStatus = computeKpiStatus({
    direction: kpi.direction,
    toleranceType: kpi.toleranceType,
    greenTolerance: kpi.greenTolerance,
    yellowTolerance: kpi.yellowTolerance,
    value,
    target: kpi.targetValue,
  });

  let status: StatusTone;
  if (computedStatus) {
    status = computedStatus;
  } else if (isStatusTone(input.status)) {
    status = input.status;
  } else {
    return { ok: false, error: "Ogiltig status." };
  }

  const comment = input.comment?.trim() ?? "";
  if ((status === "Gul" || status === "Röd") && !comment) {
    return {
      ok: false,
      error: "Beskriv kort varför KPI:n avviker.",
    };
  }

  return {
    ok: true,
    value: {
      kpiId: kpi.id,
      reportDate: input.reportDate,
      value,
      status,
      comment: comment || undefined,
    },
  };
}

export function formatBatchDailyReportError(kpiNames: string[]): string {
  return `Kunde inte spara. Fel i: ${kpiNames.join(", ")}.`;
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export type CollectBatchDailyReportsResult =
  | { ok: true; reports: PreparedDailyKpiReport[] }
  | { ok: false; kpiNames: string[] };

/**
 * Validate every submitted daily field, then return the rows to upsert.
 * GROUPED ratio inputs: both empty skip; one filled fail; both filled save.
 * Empty standalone fields skip. `"0"` is saved. Invalid mix aborts all.
 */
export function collectBatchDailyReports(input: {
  reportDate: string;
  kpis: DailyKpiValidationKpi[];
  drafts: DailyReportDraft[];
}): CollectBatchDailyReportsResult {
  const draftsById = new Map<string, DailyReportDraft>();
  for (const draft of input.drafts) {
    const kpiId = draft.kpiId.trim();
    if (!kpiId) continue;
    draftsById.set(kpiId, draft);
  }

  const groups = findRatioPercentGroups(input.kpis);
  const groupedInputIds = new Set<string>();
  for (const group of groups) {
    groupedInputIds.add(group.numeratorKpiId);
    groupedInputIds.add(group.denominatorKpiId);
  }
  const groupedMemberIds = collectRatioGroupMemberIds(groups);

  const kpisById = new Map(input.kpis.map((kpi) => [kpi.id, kpi]));
  const failedNames: string[] = [];
  const reports: PreparedDailyKpiReport[] = [];

  for (const group of groups) {
    const numerator = kpisById.get(group.numeratorKpiId);
    const denominator = kpisById.get(group.denominatorKpiId);
    if (!numerator || !denominator) continue;

    const numDraft = draftsById.get(numerator.id);
    const denDraft = draftsById.get(denominator.id);
    const numValue = numDraft?.value ?? "";
    const denValue = denDraft?.value ?? "";
    const numFilled = !isSkippedDailyReportValue(numValue);
    const denFilled = !isSkippedDailyReportValue(denValue);

    if (!numFilled && !denFilled) {
      continue;
    }
    if (numFilled !== denFilled) {
      failedNames.push(numerator.name, denominator.name);
      continue;
    }

    const preparedNum = prepareDailyKpiReport(numerator, {
      value: numValue,
      status: numDraft?.status ?? "Statistik",
      comment: numDraft?.comment,
      reportDate: input.reportDate,
    });
    const preparedDen = prepareDailyKpiReport(denominator, {
      value: denValue,
      status: denDraft?.status ?? "Statistik",
      comment: denDraft?.comment,
      reportDate: input.reportDate,
    });
    if (!preparedNum.ok) failedNames.push(numerator.name);
    else reports.push(preparedNum.value);
    if (!preparedDen.ok) failedNames.push(denominator.name);
    else reports.push(preparedDen.value);
  }

  for (const kpi of input.kpis) {
    if (groupedInputIds.has(kpi.id)) continue;
    const draft = draftsById.get(kpi.id);
    if (!draft || isSkippedDailyReportValue(draft.value)) {
      continue;
    }
    if (!isDailyManualReportableKpi(kpi) || groupedMemberIds.has(kpi.id)) {
      failedNames.push(kpi.name);
      continue;
    }
    const prepared = prepareDailyKpiReport(kpi, {
      value: draft.value,
      status: draft.status,
      comment: draft.comment,
      reportDate: input.reportDate,
    });
    if (!prepared.ok) {
      failedNames.push(kpi.name);
      continue;
    }
    reports.push(prepared.value);
  }

  for (const draft of input.drafts) {
    const kpiId = draft.kpiId.trim();
    if (!kpiId || isSkippedDailyReportValue(draft.value)) continue;
    if (!kpisById.has(kpiId)) {
      failedNames.push("Okänd KPI");
    }
  }

  const names = uniqueNames(failedNames);
  if (names.length > 0) {
    return { ok: false, kpiNames: names };
  }
  return { ok: true, reports };
}
