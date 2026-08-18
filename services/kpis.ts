import { isKpiArchived } from "@/lib/kpi/archive";
import { parseKpiCalcOperator } from "@/lib/kpi/calculated";
import {
  computeKpiStatus,
  defaultToleranceTypeForTarget,
  validateGreenYellowTolerances,
  type KpiDirection,
  type KpiToleranceType,
} from "@/lib/kpi/computeStatus";
import {
  hasValidKpiCurrentValue,
  isCalculatedKpi,
  isNonTargetKpi,
  isStatisticKpi,
  isSystemComputedKpi,
  parseKpiKind,
  parseKpiRatioReportingMode,
  parseKpiReportingFrequency,
  parseKpiStoredStatus,
  STATISTIC_STATUS,
  type KpiCalcOperator,
  type KpiKind,
  type KpiReportingFrequency,
} from "@/lib/kpi/kind";
import { parseNumeric } from "@/lib/kpi/parseNumeric";
import { shouldWriteKpiMeasurementHistory } from "@/lib/kpi/shouldWriteMeasurementHistory";
import {
  expectedResultPeriodMonth,
  isMonthlyEconomicResultKpi,
} from "@/lib/kpi/economics";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { fetchKpiHistoryByPeriodMonthsForKpis } from "@/lib/supabase/kpi-history";
import {
  fetchAllKpis,
  fetchKpiById,
  fetchKpisByBusinessAreaId,
  insertKpi,
  updateKpiArchivedAt,
  updateKpiRow,
  type KpiRow,
} from "@/lib/supabase/kpis";
import { recordAuditLog } from "@/services/auditLog";
import {
  collectFieldChanges,
  formatEntityChangeDescription,
  formatEntityCreateDescription,
  resolveActorName,
  snapshotCreateChanges,
} from "@/services/changeHistory";
import { addKPIHistoryEntry } from "@/services/kpiHistory";
import type {
  CreateKPIInput,
  KPI,
  KpiStoredStatus,
  KpiTrend,
  StatusTone,
  UpdateKPIInput,
} from "@/types";

const DEFAULT_ACTOR = "Peter Sagebrant";

/** Fields logged on create/update for structured from/to history. */
const KPI_TRACKED_FIELDS = [
  "name",
  "category",
  "target_value",
  "current_value",
  "unit",
  "status",
  "trend",
  "business_area_id",
  "kpi_kind",
  "direction",
  "tolerance_type",
  "green_tolerance",
  "yellow_tolerance",
  "calc_operator",
  "calc_numerator_kpi_id",
  "calc_denominator_kpi_id",
  "reporting_frequency",
] as const;

function toTrend(value: string): KpiTrend {
  if (value === "Upp" || value === "Oförändrad" || value === "Ner") {
    return value;
  }
  return "Oförändrad";
}

function toDirection(
  value: string | null | undefined,
): KpiDirection | null {
  if (
    value === "HIGHER_IS_BETTER" ||
    value === "LOWER_IS_BETTER" ||
    value === "TARGET_IS_BEST"
  ) {
    return value;
  }
  return null;
}

function toToleranceType(
  value: string | null | undefined,
): KpiToleranceType | null {
  if (value === "PERCENT" || value === "ABSOLUTE") {
    return value;
  }
  return null;
}

function toToleranceNumber(
  value: number | string | null | undefined,
): number | null {
  return parseNumeric(value);
}

function mapKpiRow(row: KpiRow): KPI {
  const kind = parseKpiKind(row.kpi_kind);
  const nonTarget = isNonTargetKpi({ kind });
  const calcOperator = parseKpiCalcOperator(row.calc_operator);
  const hasCalc =
    kind === "CALCULATED" ||
    (kind === "TARGET" && calcOperator != null);
  return {
    id: row.id,
    businessAreaId: row.business_area_id,
    name: row.name,
    category: row.category,
    targetValue: row.target_value,
    currentValue: row.current_value,
    unit: row.unit,
    status: parseKpiStoredStatus(row.status),
    trend: toTrend(row.trend),
    kind,
    direction: nonTarget ? null : toDirection(row.direction),
    toleranceType: nonTarget ? null : toToleranceType(row.tolerance_type),
    greenTolerance: nonTarget ? null : toToleranceNumber(row.green_tolerance),
    yellowTolerance: nonTarget ? null : toToleranceNumber(row.yellow_tolerance),
    calcOperator: hasCalc ? calcOperator : null,
    calcNumeratorKpiId: hasCalc ? row.calc_numerator_kpi_id ?? null : null,
    calcDenominatorKpiId: hasCalc ? row.calc_denominator_kpi_id ?? null : null,
    ratioReportingMode: parseKpiRatioReportingMode(row.ratio_reporting_mode),
    reportingFrequency: parseKpiReportingFrequency(row.reporting_frequency),
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function enrichMonthlyResultPeriods<T extends KPI>(kpis: T[]): Promise<T[]> {
  const resultIds = new Set(
    kpis
      .filter(isMonthlyEconomicResultKpi)
      .map((kpi) => kpi.id),
  );
  if (resultIds.size === 0) return kpis;

  const expected = expectedResultPeriodMonth();
  const rows = await fetchKpiHistoryByPeriodMonthsForKpis([...resultIds]).catch(
    () => [],
  );
  const latestByKpi = new Map<string, (typeof rows)[number]>();
  const latestCompleteByKpi = new Map<string, string>();
  for (const row of rows) {
    if (row.period_month && !latestByKpi.has(row.kpi_id)) {
      latestByKpi.set(row.kpi_id, row);
    }
    if (
      row.period_month &&
      row.actual_value != null &&
      row.budget_value != null &&
      !latestCompleteByKpi.has(row.kpi_id)
    ) {
      latestCompleteByKpi.set(row.kpi_id, row.period_month);
    }
  }
  return kpis.map((kpi) => {
    if (!resultIds.has(kpi.id)) return kpi;
    const latestRow = latestByKpi.get(kpi.id);
    const latestPeriodMonth = latestRow?.period_month ?? null;
    const latestCompletePeriodMonth = latestCompleteByKpi.get(kpi.id) ?? null;
    return {
      ...kpi,
      latestPeriodMonth,
      expectedPeriodMonth: expected,
      isPeriodPending: latestCompletePeriodMonth !== expected,
      latestActualValue: latestRow?.actual_value ?? null,
      latestBudgetValue: latestRow?.budget_value ?? null,
      latestIsLegacyDeviation:
        latestRow != null &&
        latestRow.actual_value == null &&
        latestRow.budget_value == null,
    };
  });
}

function normalizeAutoStatusFields(input: {
  direction?: KpiDirection | null;
  toleranceType?: KpiToleranceType | null;
  greenTolerance?: number | null;
  yellowTolerance?: number | null;
  targetValue?: string | null;
}): {
  direction: KpiDirection | null;
  tolerance_type: KpiToleranceType | null;
  green_tolerance: number | null;
  yellow_tolerance: number | null;
} {
  const direction = input.direction ?? null;
  if (!direction) {
    return {
      direction: null,
      tolerance_type: null,
      green_tolerance: null,
      yellow_tolerance: null,
    };
  }

  const yellow =
    input.yellowTolerance != null && Number.isFinite(input.yellowTolerance)
      ? input.yellowTolerance
      : null;
  const green =
    input.greenTolerance != null && Number.isFinite(input.greenTolerance)
      ? input.greenTolerance
      : null;

  const toleranceError = validateGreenYellowTolerances(green, yellow);
  if (toleranceError) {
    throw new Error(toleranceError);
  }

  return {
    direction,
    tolerance_type:
      input.toleranceType ??
      defaultToleranceTypeForTarget(input.targetValue ?? null),
    green_tolerance: green,
    yellow_tolerance: yellow,
  };
}

/** Prefer computed status when direction + values allow it. */
function resolveSnapshotStatus(input: {
  direction: KpiDirection | null;
  toleranceType: KpiToleranceType | null;
  greenTolerance: number | null;
  yellowTolerance: number | null;
  currentValue?: string | null;
  targetValue?: string | null;
  fallbackStatus: StatusTone;
}): StatusTone {
  const computed = computeKpiStatus({
    direction: input.direction,
    toleranceType: input.toleranceType,
    greenTolerance: input.greenTolerance,
    yellowTolerance: input.yellowTolerance,
    value: input.currentValue,
    target: input.targetValue,
  });
  return computed ?? input.fallbackStatus;
}

function resolveKindPayload(input: {
  kind?: KpiKind;
  status: StatusTone;
  targetValue?: string | null;
  currentValue?: string | null;
  direction?: KpiDirection | null;
  toleranceType?: KpiToleranceType | null;
  greenTolerance?: number | null;
  yellowTolerance?: number | null;
  calcOperator?: KpiCalcOperator | null;
  calcNumeratorKpiId?: string | null;
  calcDenominatorKpiId?: string | null;
  reportingFrequency?: KpiReportingFrequency | null;
  selfId?: string | null;
}): {
  kpi_kind: KpiKind;
  status: KpiStoredStatus;
  target_value: string | null;
  current_value: string | null;
  direction: KpiDirection | null;
  tolerance_type: KpiToleranceType | null;
  green_tolerance: number | null;
  yellow_tolerance: number | null;
  calc_operator: KpiCalcOperator | null;
  calc_numerator_kpi_id: string | null;
  calc_denominator_kpi_id: string | null;
  reporting_frequency: KpiReportingFrequency;
} {
  const kind =
    input.kind === "STATISTIC"
      ? "STATISTIC"
      : input.kind === "CALCULATED"
        ? "CALCULATED"
        : "TARGET";
  const currentValue = input.currentValue?.trim() || null;
  const reportingFrequency =
    input.reportingFrequency === "MONTHLY" ? "MONTHLY" : "DAILY";

  if (kind === "STATISTIC") {
    return {
      kpi_kind: "STATISTIC",
      status: STATISTIC_STATUS,
      target_value: null,
      current_value: currentValue,
      direction: null,
      tolerance_type: null,
      green_tolerance: null,
      yellow_tolerance: null,
      calc_operator: null,
      calc_numerator_kpi_id: null,
      calc_denominator_kpi_id: null,
      reporting_frequency: reportingFrequency,
    };
  }

  if (kind === "CALCULATED") {
    const operator =
      input.calcOperator === "DIVIDE" ||
      input.calcOperator === "SUM_DIVIDE" ||
      input.calcOperator === "MONTH_TO_DATE_SUM"
        ? input.calcOperator
        : null;
    const numeratorId = input.calcNumeratorKpiId?.trim() || null;
    const denominatorId = input.calcDenominatorKpiId?.trim() || null;

    if (!operator) {
      throw new Error("Välj beräkningsoperator.");
    }
    if (operator !== "MONTH_TO_DATE_SUM" && !denominatorId) {
      throw new Error("Välj nämnare för beräknad KPI.");
    }
    if (operator === "MONTH_TO_DATE_SUM") {
      if (!numeratorId) {
        throw new Error("Välj käll-KPI för månadssummering.");
      }
      if (input.selfId && numeratorId === input.selfId) {
        throw new Error("En beräknad KPI kan inte referera till sig själv.");
      }
      return {
        kpi_kind: "CALCULATED",
        status: STATISTIC_STATUS,
        target_value: null,
        current_value: currentValue,
        direction: null,
        tolerance_type: null,
        green_tolerance: null,
        yellow_tolerance: null,
        calc_operator: "MONTH_TO_DATE_SUM",
        calc_numerator_kpi_id: numeratorId,
        calc_denominator_kpi_id: null,
        reporting_frequency: reportingFrequency,
      };
    }
    if (operator === "DIVIDE") {
      if (!numeratorId) {
        throw new Error("Välj täljare och nämnare för beräknad KPI.");
      }
      if (numeratorId === denominatorId) {
        throw new Error("Täljare och nämnare måste vara olika KPI:er.");
      }
      if (
        input.selfId &&
        (numeratorId === input.selfId || denominatorId === input.selfId)
      ) {
        throw new Error("En beräknad KPI kan inte referera till sig själv.");
      }
      return {
        kpi_kind: "CALCULATED",
        status: STATISTIC_STATUS,
        target_value: null,
        current_value: currentValue,
        direction: null,
        tolerance_type: null,
        green_tolerance: null,
        yellow_tolerance: null,
        calc_operator: "DIVIDE",
        calc_numerator_kpi_id: numeratorId,
        calc_denominator_kpi_id: denominatorId,
        reporting_frequency: reportingFrequency,
      };
    }

    // SUM_DIVIDE — numerators live in kpi_calc_sum_numerators junction
    if (input.selfId && denominatorId === input.selfId) {
      throw new Error("En beräknad KPI kan inte referera till sig själv.");
    }
    return {
      kpi_kind: "CALCULATED",
      status: STATISTIC_STATUS,
      target_value: null,
      current_value: currentValue,
      direction: null,
      tolerance_type: null,
      green_tolerance: null,
      yellow_tolerance: null,
      calc_operator: "SUM_DIVIDE",
      calc_numerator_kpi_id: null,
      calc_denominator_kpi_id: denominatorId,
      reporting_frequency: reportingFrequency,
    };
  }

  const auto = normalizeAutoStatusFields({
    direction: input.direction,
    toleranceType: input.toleranceType,
    greenTolerance: input.greenTolerance,
    yellowTolerance: input.yellowTolerance,
    targetValue: input.targetValue,
  });
  const targetValue = input.targetValue?.trim() || null;
  const status = resolveSnapshotStatus({
    direction: auto.direction,
    toleranceType: auto.tolerance_type,
    greenTolerance: auto.green_tolerance,
    yellowTolerance: auto.yellow_tolerance,
    currentValue,
    targetValue,
    fallbackStatus: input.status,
  });

  // Preserve / set system-computed TARGET ratio metadata (seeded Sjukfrånvaro).
  const targetCalcOperator =
    input.calcOperator === "RATIO_PERCENT" ||
    input.calcOperator === "WEIGHTED_RATIO_PERCENT"
      ? input.calcOperator
      : null;

  if (targetCalcOperator === "RATIO_PERCENT") {
    const numeratorId = input.calcNumeratorKpiId?.trim() || null;
    const denominatorId = input.calcDenominatorKpiId?.trim() || null;
    if (!numeratorId || !denominatorId) {
      throw new Error("Välj täljare och nämnare för beräknad andel.");
    }
    if (numeratorId === denominatorId) {
      throw new Error("Täljare och nämnare måste vara olika KPI:er.");
    }
    if (!targetValue) {
      throw new Error("Målvärde krävs för beräknad TARGET-KPI.");
    }
    if (!auto.direction) {
      throw new Error("Riktning krävs för beräknad TARGET-KPI.");
    }
    return {
      kpi_kind: "TARGET",
      status,
      target_value: targetValue,
      current_value: currentValue,
      direction: auto.direction,
      tolerance_type: auto.tolerance_type,
      green_tolerance: auto.green_tolerance,
      yellow_tolerance: auto.yellow_tolerance,
      calc_operator: "RATIO_PERCENT",
      calc_numerator_kpi_id: numeratorId,
      calc_denominator_kpi_id: denominatorId,
      reporting_frequency: reportingFrequency,
    };
  }

  if (targetCalcOperator === "WEIGHTED_RATIO_PERCENT") {
    if (!targetValue) {
      throw new Error("Målvärde krävs för viktad beräknad TARGET-KPI.");
    }
    if (!auto.direction) {
      throw new Error("Riktning krävs för viktad beräknad TARGET-KPI.");
    }
    return {
      kpi_kind: "TARGET",
      status,
      target_value: targetValue,
      current_value: currentValue,
      direction: auto.direction,
      tolerance_type: auto.tolerance_type,
      green_tolerance: auto.green_tolerance,
      yellow_tolerance: auto.yellow_tolerance,
      calc_operator: "WEIGHTED_RATIO_PERCENT",
      calc_numerator_kpi_id: null,
      calc_denominator_kpi_id: null,
      reporting_frequency: reportingFrequency,
    };
  }

  return {
    kpi_kind: "TARGET",
    status,
    target_value: targetValue,
    current_value: currentValue,
    direction: auto.direction,
    tolerance_type: auto.tolerance_type,
    green_tolerance: auto.green_tolerance,
    yellow_tolerance: auto.yellow_tolerance,
    calc_operator: null,
    calc_numerator_kpi_id: null,
    calc_denominator_kpi_id: null,
    reporting_frequency: reportingFrequency,
  };
}

async function assertCalcInputsSameArea(input: {
  businessAreaId: string;
  numeratorId: string;
  denominatorId: string;
}): Promise<void> {
  const [numerator, denominator] = await Promise.all([
    fetchKpiById(input.numeratorId),
    fetchKpiById(input.denominatorId),
  ]);
  if (!numerator || !denominator) {
    throw new Error("Täljare eller nämnare hittades inte.");
  }
  if (
    numerator.business_area_id !== input.businessAreaId ||
    denominator.business_area_id !== input.businessAreaId
  ) {
    throw new Error(
      "Täljare och nämnare måste tillhöra samma affärsområde som den beräknade KPI:n.",
    );
  }
  if (parseKpiKind(numerator.kpi_kind) === "CALCULATED") {
    throw new Error("Täljaren får inte vara en beräknad KPI.");
  }
  if (parseKpiKind(denominator.kpi_kind) === "CALCULATED") {
    throw new Error("Nämnaren får inte vara en beräknad KPI.");
  }
}

export type KPIListItem = KPI & {
  businessAreaName: string;
};

export { isKpiArchived };

export async function getKPIsByBusinessArea(
  businessAreaId: string,
): Promise<KPI[]> {
  try {
    const rows = await fetchKpisByBusinessAreaId(businessAreaId, {
      includeArchived: false,
    });
    return await enrichMonthlyResultPeriods(rows.map(mapKpiRow));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("kpis") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }
}

export async function getKPIs(options?: {
  includeArchived?: boolean;
}): Promise<KPIListItem[]> {
  const [rows, areas] = await Promise.all([
    fetchAllKpis({ includeArchived: options?.includeArchived ?? false }),
    fetchBusinessAreas(),
  ]);

  const areaNames = new Map(areas.map((area) => [area.id, area.name]));

  const mapped = rows.map((row) => ({
    ...mapKpiRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
  }));
  return enrichMonthlyResultPeriods(mapped);
}

export async function getKPIById(id: string): Promise<KPIListItem | null> {
  const row = await fetchKpiById(id);
  if (!row) {
    return null;
  }

  const areas = await fetchBusinessAreas();
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));

  const mapped = {
    ...mapKpiRow(row),
    businessAreaName: areaNames.get(row.business_area_id) ?? "Okänt område",
  };
  return (await enrichMonthlyResultPeriods([mapped]))[0] ?? null;
}

export async function createKPI(input: CreateKPIInput): Promise<KPI> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Namn är obligatoriskt.");
  }

  if (!input.businessAreaId) {
    throw new Error("businessAreaId är obligatoriskt.");
  }

  const resolved = resolveKindPayload({
    kind: input.kind,
    status: input.status,
    targetValue: input.targetValue,
    currentValue: input.currentValue,
    direction: input.direction,
    toleranceType: input.toleranceType,
    greenTolerance: input.greenTolerance,
    yellowTolerance: input.yellowTolerance,
    calcOperator: input.calcOperator,
    calcNumeratorKpiId: input.calcNumeratorKpiId,
    calcDenominatorKpiId: input.calcDenominatorKpiId,
    reportingFrequency: input.reportingFrequency,
  });

  if (
    (resolved.kpi_kind === "CALCULATED" ||
      resolved.calc_operator === "RATIO_PERCENT") &&
    resolved.calc_numerator_kpi_id &&
    resolved.calc_denominator_kpi_id
  ) {
    await assertCalcInputsSameArea({
      businessAreaId: input.businessAreaId,
      numeratorId: resolved.calc_numerator_kpi_id,
      denominatorId: resolved.calc_denominator_kpi_id,
    });
  } else if (
    resolved.kpi_kind === "CALCULATED" &&
    resolved.calc_operator === "SUM_DIVIDE" &&
    resolved.calc_denominator_kpi_id
  ) {
    const denominator = await fetchKpiById(resolved.calc_denominator_kpi_id);
    if (!denominator) {
      throw new Error("Nämnare hittades inte.");
    }
    if (denominator.business_area_id !== input.businessAreaId) {
      throw new Error(
        "Nämnaren måste tillhöra samma affärsområde som den beräknade KPI:n.",
      );
    }
  } else if (
    resolved.kpi_kind === "CALCULATED" &&
    resolved.calc_operator === "MONTH_TO_DATE_SUM" &&
    resolved.calc_numerator_kpi_id
  ) {
    const source = await fetchKpiById(resolved.calc_numerator_kpi_id);
    if (!source || source.business_area_id !== input.businessAreaId) {
      throw new Error("Käll-KPI:n måste tillhöra samma affärsområde.");
    }
  }

  const payload = {
    business_area_id: input.businessAreaId,
    name,
    category: input.category?.trim() || null,
    target_value: resolved.target_value,
    current_value: resolved.current_value,
    unit: input.unit?.trim() || null,
    status: resolved.status,
    trend: input.trend,
    kpi_kind: resolved.kpi_kind,
    direction: resolved.direction,
    tolerance_type: resolved.tolerance_type,
    green_tolerance: resolved.green_tolerance,
    yellow_tolerance: resolved.yellow_tolerance,
    calc_operator: resolved.calc_operator,
    calc_numerator_kpi_id: resolved.calc_numerator_kpi_id,
    calc_denominator_kpi_id: resolved.calc_denominator_kpi_id,
    reporting_frequency: resolved.reporting_frequency,
  };

  const row = await insertKpi(payload);

  const createChanges = snapshotCreateChanges(payload, KPI_TRACKED_FIELDS);
  const actorName = await resolveActorName(DEFAULT_ACTOR);
  await recordAuditLog({
    entityType: "kpi",
    entityId: row.id,
    action: "created",
    description: formatEntityCreateDescription("KPI:n", row.name),
    actorName,
    businessAreaId: row.business_area_id,
    changes: createChanges.length > 0 ? { fields: createChanges } : null,
  });

  if (
    resolved.kpi_kind !== "CALCULATED" &&
    !isSystemComputedKpi({
      kind: resolved.kpi_kind,
      calcOperator: resolved.calc_operator,
    }) &&
    hasValidKpiCurrentValue(row.current_value)
  ) {
    try {
      await addKPIHistoryEntry(
        {
          kpiId: row.id,
          value: row.current_value!.trim(),
          status: parseKpiStoredStatus(row.status),
          comment: "Initial historik vid skapande",
          recordedAt: new Date().toISOString(),
        },
        // KPI row already holds current_value/status.
        { skipAudit: true, syncCurrent: false },
      );
    } catch {
      // Historik får inte blockera skapandet.
    }
  }

  return mapKpiRow(row);
}

export async function updateKPI(input: UpdateKPIInput): Promise<KPI> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Namn är obligatoriskt.");
  }

  if (!input.id) {
    throw new Error("id är obligatoriskt.");
  }

  if (!input.businessAreaId) {
    throw new Error("businessAreaId är obligatoriskt.");
  }

  const existing = await fetchKpiById(input.id);
  if (!existing) {
    throw new Error("KPI hittades inte.");
  }

  const nextKind = input.kind ?? parseKpiKind(existing.kpi_kind);
  const existingCalc = parseKpiCalcOperator(existing.calc_operator);
  // Admin forms may omit calc fields — preserve seeded system-computed TARGET links.
  const preserveTargetCalc =
    nextKind === "TARGET" &&
    existingCalc != null &&
    input.calcOperator == null;
  // Admin DIVIDE form must not rewrite seeded SUM_DIVIDE (junction numerators).
  const preserveSpecialCalculated =
    nextKind === "CALCULATED" &&
    (existingCalc === "SUM_DIVIDE" || existingCalc === "MONTH_TO_DATE_SUM");
  const preserveCalc = preserveTargetCalc || preserveSpecialCalculated;

  const resolved = resolveKindPayload({
    kind: nextKind,
    status: input.status,
    targetValue: input.targetValue,
    currentValue:
      nextKind === "CALCULATED" ||
      (nextKind === "TARGET" &&
        (input.calcOperator != null || existingCalc != null))
        ? existing.current_value
        : input.currentValue,
    direction: input.direction,
    toleranceType: input.toleranceType,
    greenTolerance: input.greenTolerance,
    yellowTolerance: input.yellowTolerance,
    calcOperator: preserveCalc ? existingCalc : input.calcOperator,
    calcNumeratorKpiId: preserveCalc
      ? existing.calc_numerator_kpi_id
      : input.calcNumeratorKpiId,
    calcDenominatorKpiId: preserveCalc
      ? existing.calc_denominator_kpi_id
      : input.calcDenominatorKpiId,
    reportingFrequency:
      input.reportingFrequency ??
      parseKpiReportingFrequency(existing.reporting_frequency),
    selfId: input.id,
  });

  if (
    (resolved.kpi_kind === "CALCULATED" ||
      resolved.calc_operator === "RATIO_PERCENT") &&
    resolved.calc_numerator_kpi_id &&
    resolved.calc_denominator_kpi_id
  ) {
    await assertCalcInputsSameArea({
      businessAreaId: input.businessAreaId,
      numeratorId: resolved.calc_numerator_kpi_id,
      denominatorId: resolved.calc_denominator_kpi_id,
    });
  } else if (
    resolved.kpi_kind === "CALCULATED" &&
    resolved.calc_operator === "SUM_DIVIDE" &&
    resolved.calc_denominator_kpi_id
  ) {
    const denominator = await fetchKpiById(resolved.calc_denominator_kpi_id);
    if (!denominator) {
      throw new Error("Nämnare hittades inte.");
    }
    if (denominator.business_area_id !== input.businessAreaId) {
      throw new Error(
        "Nämnaren måste tillhöra samma affärsområde som den beräknade KPI:n.",
      );
    }
  } else if (
    resolved.kpi_kind === "CALCULATED" &&
    resolved.calc_operator === "MONTH_TO_DATE_SUM" &&
    resolved.calc_numerator_kpi_id
  ) {
    const source = await fetchKpiById(resolved.calc_numerator_kpi_id);
    if (!source || source.business_area_id !== input.businessAreaId) {
      throw new Error("Käll-KPI:n måste tillhöra samma affärsområde.");
    }
  }

  const next = {
    business_area_id: input.businessAreaId,
    name,
    category: input.category?.trim() || null,
    target_value: resolved.target_value,
    current_value: resolved.current_value,
    unit: input.unit?.trim() || null,
    status: resolved.status,
    trend: input.trend,
    kpi_kind: resolved.kpi_kind,
    direction: resolved.direction,
    tolerance_type: resolved.tolerance_type,
    green_tolerance: resolved.green_tolerance,
    yellow_tolerance: resolved.yellow_tolerance,
    calc_operator: resolved.calc_operator,
    calc_numerator_kpi_id: resolved.calc_numerator_kpi_id,
    calc_denominator_kpi_id: resolved.calc_denominator_kpi_id,
    reporting_frequency: resolved.reporting_frequency,
  };

  const changes = collectFieldChanges(
    {
      business_area_id: existing.business_area_id,
      name: existing.name,
      category: existing.category,
      target_value: existing.target_value,
      current_value: existing.current_value,
      unit: existing.unit,
      status: existing.status,
      trend: existing.trend,
      kpi_kind: existing.kpi_kind ?? "TARGET",
      direction: existing.direction,
      tolerance_type: existing.tolerance_type,
      green_tolerance: toToleranceNumber(existing.green_tolerance),
      yellow_tolerance: toToleranceNumber(existing.yellow_tolerance),
      calc_operator: existing.calc_operator,
      calc_numerator_kpi_id: existing.calc_numerator_kpi_id,
      calc_denominator_kpi_id: existing.calc_denominator_kpi_id,
      reporting_frequency: parseKpiReportingFrequency(
        existing.reporting_frequency,
      ),
    },
    next,
    KPI_TRACKED_FIELDS,
  );

  const row = await updateKpiRow(input.id, {
    ...next,
    updated_at: new Date().toISOString(),
  });

  if (changes.length > 0) {
    const actorName = await resolveActorName(DEFAULT_ACTOR);
    await recordAuditLog({
      entityType: "kpi",
      entityId: row.id,
      action: "updated",
      description: formatEntityChangeDescription("KPI:n", row.name, changes),
      actorName,
      businessAreaId: row.business_area_id,
      changes: { fields: changes },
    });

    // Measurement history only when utfall (current_value) changes.
    // Metadata (direction/tolerance/target/name/…) may recompute status on the
    // kpis row for snapshot consistency — that must not insert kpi_history.
    // Status-only admin edits also skip history; use /admin/kpis/[id] or daily
    // report for intentional measurement points.
    if (shouldWriteKpiMeasurementHistory(changes)) {
      const historyValue = next.current_value?.trim() ?? "";
      if (hasValidKpiCurrentValue(historyValue)) {
        try {
          await addKPIHistoryEntry(
            {
              kpiId: row.id,
              value: historyValue,
              status: parseKpiStoredStatus(next.status),
              comment: "Automatisk historik vid KPI-uppdatering",
              recordedAt: new Date().toISOString(),
            },
            // KPI row already updated above.
            { skipAudit: true, syncCurrent: false },
          );
        } catch {
          // Historik får inte blockera huvuduppdateringen.
        }
      }
    }
  }

  return mapKpiRow(row);
}

export async function archiveKPI(id: string): Promise<KPIListItem> {
  const existing = await fetchKpiById(id);
  if (!existing) {
    throw new Error("KPI hittades inte.");
  }
  if (existing.archived_at) {
    throw new Error("KPI:n är redan arkiverad.");
  }

  const row = await updateKpiArchivedAt(id, new Date().toISOString());
  const areas = await fetchBusinessAreas();
  const areaName =
    areas.find((area) => area.id === row.business_area_id)?.name ??
    "Okänt område";

  const actorName = await resolveActorName(DEFAULT_ACTOR);
  await recordAuditLog({
    entityType: "kpi",
    entityId: row.id,
    action: "updated",
    description: `KPI:n "${row.name}" arkiverades (${areaName}).`,
    actorName,
    businessAreaId: row.business_area_id,
    changes: {
      fields: [
        {
          field: "archived_at",
          from: null,
          to: row.archived_at,
        },
      ],
    },
  });

  return {
    ...mapKpiRow(row),
    businessAreaName: areaName,
  };
}

export async function unarchiveKPI(id: string): Promise<KPIListItem> {
  const existing = await fetchKpiById(id);
  if (!existing) {
    throw new Error("KPI hittades inte.");
  }
  if (!existing.archived_at) {
    throw new Error("KPI:n är redan aktiv.");
  }

  const row = await updateKpiArchivedAt(id, null);
  const areas = await fetchBusinessAreas();
  const areaName =
    areas.find((area) => area.id === row.business_area_id)?.name ??
    "Okänt område";

  const actorName = await resolveActorName(DEFAULT_ACTOR);
  await recordAuditLog({
    entityType: "kpi",
    entityId: row.id,
    action: "updated",
    description: `KPI:n "${row.name}" återaktiverades (${areaName}).`,
    actorName,
    businessAreaId: row.business_area_id,
    changes: {
      fields: [
        {
          field: "archived_at",
          from: existing.archived_at,
          to: null,
        },
      ],
    },
  });

  return {
    ...mapKpiRow(row),
    businessAreaName: areaName,
  };
}

export {
  isCalculatedKpi,
  isNonTargetKpi,
  isStatisticKpi,
  isSystemComputedKpi,
};
