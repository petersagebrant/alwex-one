import type { StatusTone } from "./status";

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
  status: StatusTone;
  trend: KpiTrend;
  /** NULL = manual status in daily reporting. */
  direction: KpiDirection | null;
  toleranceType: KpiToleranceType | null;
  yellowTolerance: number | null;
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
  direction?: KpiDirection | null;
  toleranceType?: KpiToleranceType | null;
  yellowTolerance?: number | null;
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
  direction?: KpiDirection | null;
  toleranceType?: KpiToleranceType | null;
  yellowTolerance?: number | null;
};
