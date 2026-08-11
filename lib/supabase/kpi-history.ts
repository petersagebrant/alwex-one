import { createClient } from "@/lib/supabase/server";

export type KpiHistoryRow = {
  id: string;
  kpi_id: string;
  value: string;
  status: string;
  comment: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  report_date: string | null;
  recorded_by: string | null;
};

export type InsertKpiHistoryInput = {
  kpi_id: string;
  value: string;
  status: string;
  comment: string | null;
  recorded_at: string;
  report_date?: string | null;
  recorded_by?: string | null;
};

export type UpsertDailyKpiReportRpcInput = {
  p_kpi_id: string;
  p_report_date: string;
  p_value: string;
  p_status: string;
  p_comment: string | null;
  p_recorded_by: string | null;
};

const kpiHistorySelect =
  "id, kpi_id, value, status, comment, recorded_at, created_at, updated_at, report_date, recorded_by";

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

export async function upsertDailyKpiReportRow(
  input: UpsertDailyKpiReportRpcInput,
): Promise<KpiHistoryRow> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("upsert_daily_kpi_report", input);

  if (error) {
    throw new Error(`Kunde inte spara daglig KPI-rapport: ${error.message}`);
  }

  if (!data) {
    throw new Error("Kunde inte spara daglig KPI-rapport: tomt svar.");
  }

  return data as KpiHistoryRow;
}

/** All daily report rows for a calendar date (report_date = YYYY-MM-DD). */
export async function fetchKpiHistoryByReportDate(
  reportDate: string,
): Promise<KpiHistoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .eq("report_date", reportDate);

  if (error) {
    throw new Error(
      `Kunde inte hämta dagliga KPI-rapporter: ${error.message}`,
    );
  }

  return data ?? [];
}

/** Daily report rows for specific KPIs on a calendar date. */
export async function fetchKpiHistoryByReportDateForKpis(
  kpiIds: string[],
  reportDate: string,
): Promise<KpiHistoryRow[]> {
  if (kpiIds.length === 0) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .in("kpi_id", kpiIds)
    .eq("report_date", reportDate);

  if (error) {
    throw new Error(
      `Kunde inte hämta dagliga KPI-rapporter: ${error.message}`,
    );
  }

  return data ?? [];
}

export async function fetchRecentKpiHistory(
  limit = 20,
): Promise<KpiHistoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Kunde inte hämta KPI-historik: ${error.message}`);
  }

  return data ?? [];
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
    // Daily trends first (report_date desc, nulls last), then recorded_at.
    .order("report_date", { ascending: false, nullsFirst: false })
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
