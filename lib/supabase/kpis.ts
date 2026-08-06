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
  updated_at: string;
};

const kpiSelect =
  "id, business_area_id, name, category, target_value, current_value, unit, status, trend, created_at, updated_at";

export async function fetchKpisByBusinessAreaId(
  businessAreaId: string,
): Promise<KpiRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .select(kpiSelect)
    .eq("business_area_id", businessAreaId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta kpis: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchAllKpis(): Promise<KpiRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .select(kpiSelect)
    .order("updated_at", { ascending: false });

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
