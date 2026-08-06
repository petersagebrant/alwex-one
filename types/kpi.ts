import type { StatusTone } from "./status";

export type KpiTrend = "Upp" | "Oförändrad" | "Ner";

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
};
