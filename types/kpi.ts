import type { StatusTone } from "./status";
import type { KpiCalcOperator, KpiKind, KpiStoredStatus } from "@/lib/kpi/kind";

export type { KpiCalcOperator, KpiKind, KpiStoredStatus } from "@/lib/kpi/kind";

export type KpiTrend = "Upp" | "Oförändrad" | "Ner";

export type KpiDirection =
  | "HIGHER_IS_BETTER"
  | "LOWER_IS_BETTER"
  | "TARGET_IS_BEST";

export type KpiToleranceType = "PERCENT" | "ABSOLUTE";

export type KPI = {
  id: string;
  businessAreaId: string;
  name: string;
  category: string | null;
  targetValue: string | null;
  currentValue: string | null;
  unit: string | null;
  /** Grön/Gul/Röd for TARGET (incl. system-computed ratio %); Statistik for STATISTIC/CALCULATED. */
  status: KpiStoredStatus;
  trend: KpiTrend;
  /** TARGET = goal (manual or system-computed); STATISTIC = manual measure; CALCULATED = derived Statistik. */
  kind: KpiKind;
  /** NULL = manual status in daily reporting. Always null for STATISTIC/CALCULATED. */
  direction: KpiDirection | null;
  toleranceType: KpiToleranceType | null;
  /** Optional green band for TARGET_IS_BEST. NULL = tiny heuristic. */
  greenTolerance: number | null;
  yellowTolerance: number | null;
  /** CALCULATED DIVIDE, or TARGET RATIO_PERCENT / WEIGHTED_RATIO_PERCENT. */
  calcOperator: KpiCalcOperator | null;
  calcNumeratorKpiId: string | null;
  calcDenominatorKpiId: string | null;
  /** ISO timestamp when archived; null = active. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** @deprecated Använd KPI. Behålls för bakåtkompatibilitet med mockdata. */
export type Kpi = {
  id: string;
  areaSlug: string;
  label: string;
  value: string;
  target: string;
  status: StatusTone;
};

export type CreateKPIInput = {
  businessAreaId: string;
  name: string;
  category?: string;
  targetValue?: string;
  currentValue?: string;
  unit?: string;
  status: StatusTone;
  trend: KpiTrend;
  kind?: KpiKind;
  direction?: KpiDirection | null;
  toleranceType?: KpiToleranceType | null;
  greenTolerance?: number | null;
  yellowTolerance?: number | null;
  calcOperator?: KpiCalcOperator | null;
  calcNumeratorKpiId?: string | null;
  calcDenominatorKpiId?: string | null;
};

export type UpdateKPIInput = {
  id: string;
  businessAreaId: string;
  name: string;
  category?: string;
  targetValue?: string;
  currentValue?: string;
  unit?: string;
  status: StatusTone;
  trend: KpiTrend;
  kind?: KpiKind;
  direction?: KpiDirection | null;
  toleranceType?: KpiToleranceType | null;
  greenTolerance?: number | null;
  yellowTolerance?: number | null;
  calcOperator?: KpiCalcOperator | null;
  calcNumeratorKpiId?: string | null;
  calcDenominatorKpiId?: string | null;
};
