import { createClient } from "@/lib/supabase/server";

export type KpiHistoryRow = {
  id: string;
  kpi_id: string;
  value: string;
  status: string;
  comment: string | null;
  recorded_at: string;
  created_at: string;
};

export type InsertKpiHistoryInput = {
  kpi_id: string;
  value: string;
  status: string;
  comment: string | null;
  recorded_at: string;
};

const kpiHistorySelect =
  "id, kpi_id, value, status, comment, recorded_at, created_at";

export async function fetchKpiHistoryByKpiId(
  kpiId: string,
): Promise<KpiHistoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .eq("kpi_id", kpiId)
    .order("recorded_at", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta KPI-historik: ${error.message}`);
  }

  return data ?? [];
}

export async function insertKpiHistory(
  input: InsertKpiHistoryInput,
): Promise<KpiHistoryRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .insert(input)
    .select(kpiHistorySelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara KPI-historik: ${error.message}`);
  }

  return data;
}
