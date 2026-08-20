import { createClient } from "@/lib/supabase/server";

export type KpiRow = {
  id: string;
  business_area_id: string;
  name: string;
  category: string | null;
  target_value: string | null;
  current_value: string | null;
  unit: string | null;
  status: string;
  trend: string;
  kpi_kind: string;
  direction: string | null;
  tolerance_type: string | null;
  green_tolerance: number | string | null;
  yellow_tolerance: number | string | null;
  calc_operator: string | null;
  calc_numerator_kpi_id: string | null;
  calc_denominator_kpi_id: string | null;
  ratio_reporting_mode: string | null;
  reporting_frequency: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertKpiInput = {
  business_area_id: string;
  name: string;
  category: string | null;
  target_value: string | null;
  current_value: string | null;
  unit: string | null;
  status: string;
  trend: string;
  kpi_kind: string;
  direction: string | null;
  tolerance_type: string | null;
  green_tolerance: number | null;
  yellow_tolerance: number | null;
  calc_operator: string | null;
  calc_numerator_kpi_id: string | null;
  calc_denominator_kpi_id: string | null;
  reporting_frequency?: string;
};

export type UpdateKpiRowInput = {
  business_area_id: string;
  name: string;
  category: string | null;
  target_value: string | null;
  current_value: string | null;
  unit: string | null;
  status: string;
  trend: string;
  kpi_kind: string;
  direction: string | null;
  tolerance_type: string | null;
  green_tolerance: number | null;
  yellow_tolerance: number | null;
  calc_operator: string | null;
  calc_numerator_kpi_id: string | null;
  calc_denominator_kpi_id: string | null;
  reporting_frequency?: string;
  updated_at: string;
};

export type FetchKpisOptions = {
  /** Default false — operational views exclude archived KPIs. */
  includeArchived?: boolean;
};

const kpiSelect =
  "id, business_area_id, name, category, target_value, current_value, unit, status, trend, kpi_kind, direction, tolerance_type, green_tolerance, yellow_tolerance, calc_operator, calc_numerator_kpi_id, calc_denominator_kpi_id, ratio_reporting_mode, reporting_frequency, archived_at, created_at, updated_at";
export async function fetchKpisByBusinessAreaId(
  businessAreaId: string,
  options?: FetchKpisOptions,
): Promise<KpiRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("kpis")
    .select(kpiSelect)
    .eq("business_area_id", businessAreaId)
    .order("name", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Kunde inte hämta kpis: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchAllKpis(
  options?: FetchKpisOptions,
): Promise<KpiRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("kpis")
    .select(kpiSelect)
    .order("updated_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Kunde inte hämta kpis: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchKpiById(id: string): Promise<KpiRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .select(kpiSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta kpi: ${error.message}`);
  }

  return data;
}

export async function insertKpi(input: InsertKpiInput): Promise<KpiRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .insert(input)
    .select(kpiSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara kpi: ${error.message}`);
  }

  return data;
}

export async function updateKpiRow(
  id: string,
  input: UpdateKpiRowInput,
): Promise<KpiRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .update(input)
    .eq("id", id)
    .select(kpiSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera kpi: ${error.message}`);
  }

  return data;
}

export async function updateKpiArchivedAt(
  id: string,
  archivedAt: string | null,
): Promise<KpiRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .update({
      archived_at: archivedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(kpiSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera KPI-arkivering: ${error.message}`);
  }

  return data;
}

/** Sync current snapshot fields after a history write (value/status/updated_at). */
export async function updateKpiCurrentSnapshot(
  id: string,
  input: {
    current_value: string;
    status: string;
    updated_at: string;
  },
): Promise<KpiRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .update(input)
    .eq("id", id)
    .select(kpiSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte synka KPI-värde: ${error.message}`);
  }

  return data;
}
