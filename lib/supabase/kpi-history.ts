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

export async function fetchKpiHistorySince(
  cutoffIso: string,
): Promise<KpiHistoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .gte("recorded_at", cutoffIso)
    .order("recorded_at", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta KPI-historik: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchRecentKpiHistoryForKpis(
  kpiIds: string[],
  limitPerKpi = 2,
): Promise<KpiHistoryRow[]> {
  if (kpiIds.length === 0) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .in("kpi_id", kpiIds)
    .order("recorded_at", { ascending: false });

  if (error) {
    throw new Error(`Kunde inte hämta KPI-historik: ${error.message}`);
  }

  const rows = data ?? [];
  const counts = new Map<string, number>();
  const limited: KpiHistoryRow[] = [];

  for (const row of rows) {
    const count = counts.get(row.kpi_id) ?? 0;
    if (count >= limitPerKpi) {
      continue;
    }
    counts.set(row.kpi_id, count + 1);
    limited.push(row);
  }

  return limited;
}
