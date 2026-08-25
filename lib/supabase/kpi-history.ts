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
  period_month: string | null;
  actual_value: string | null;
  budget_value: string | null;
  recorded_by: string | null;
};

export type InsertKpiHistoryInput = {
  kpi_id: string;
  value: string;
  status: string;
  comment: string | null;
  recorded_at: string;
  report_date?: string | null;
  period_month?: string | null;
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

export type UpsertMonthlyKpiReportRpcInput = {
  p_kpi_id: string;
  p_period_month: string;
  p_actual_value: string;
  p_budget_value: string;
  p_comment: string | null;
  p_recorded_by: string | null;
};

export type UpsertMonthlyStatisticReportRpcInput = {
  p_kpi_id: string;
  p_period_month: string;
  p_value: string;
  p_comment: string | null;
  p_recorded_by: string | null;
};

export type UpsertDailyKpiReportsRpcInput = {
  p_reports: Array<{
    kpi_id: string;
    report_date: string;
    value: string;
    status: string;
    comment: string | null;
  }>;
  p_recorded_by: string | null;
};

const kpiHistorySelect =
  "id, kpi_id, value, status, comment, recorded_at, created_at, updated_at, report_date, period_month, actual_value, budget_value, recorded_by";

export async function fetchKpiHistoryByKpiId(
  kpiId: string,
): Promise<KpiHistoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .eq("kpi_id", kpiId)
    .is("archived_at", null)
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

export async function upsertDailyKpiReportsRows(
  input: UpsertDailyKpiReportsRpcInput,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("upsert_daily_kpi_reports", input);

  if (error) {
    throw new Error(`Kunde inte spara dagliga KPI-rapporter: ${error.message}`);
  }
}

export async function upsertMonthlyKpiReportRow(
  input: UpsertMonthlyKpiReportRpcInput,
): Promise<KpiHistoryRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_monthly_kpi_report", input);
  if (error) {
    throw new Error(`Kunde inte spara månadsresultat: ${error.message}`);
  }
  if (!data) {
    throw new Error("Kunde inte spara månadsresultat: tomt svar.");
  }
  return data as KpiHistoryRow;
}

export async function upsertMonthlyStatisticReportRow(
  input: UpsertMonthlyStatisticReportRpcInput,
): Promise<KpiHistoryRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "upsert_monthly_statistic_report",
    input,
  );
  if (error) {
    throw new Error(`Kunde inte spara månadsstatistik: ${error.message}`);
  }
  if (!data) {
    throw new Error("Kunde inte spara månadsstatistik: tomt svar.");
  }
  return data as KpiHistoryRow;
}

export async function fetchKpiHistoryByPeriodMonthsForKpis(
  kpiIds: string[],
  periodMonths?: string[],
): Promise<KpiHistoryRow[]> {
  if (kpiIds.length === 0) return [];
  const supabase = await createClient();
  let query = supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .in("kpi_id", kpiIds)
    .is("archived_at", null)
    .not("period_month", "is", null);
  if (periodMonths && periodMonths.length > 0) {
    query = query.in("period_month", periodMonths);
  }
  const { data, error } = await query
    .order("period_month", { ascending: false })
    .order("recorded_at", { ascending: false });
  if (error) {
    throw new Error(`Kunde inte hämta månadsresultat: ${error.message}`);
  }
  return data ?? [];
}

/** All daily report rows for a calendar date (report_date = YYYY-MM-DD). */
export async function fetchKpiHistoryByReportDate(
  reportDate: string,
): Promise<KpiHistoryRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .eq("report_date", reportDate)
    .is("archived_at", null);

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
    .eq("report_date", reportDate)
    .is("archived_at", null);

  if (error) {
    throw new Error(
      `Kunde inte hämta dagliga KPI-rapporter: ${error.message}`,
    );
  }

  return data ?? [];
}

/**
 * Latest active daily history row per KPI with report_date strictly before
 * `beforeReportDate`. Used for "Föregående" when backdating.
 */
export async function fetchLatestKpiHistoryBeforeReportDateForKpis(
  kpiIds: string[],
  beforeReportDate: string,
): Promise<KpiHistoryRow[]> {
  if (kpiIds.length === 0) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .in("kpi_id", kpiIds)
    .is("archived_at", null)
    .not("report_date", "is", null)
    .lt("report_date", beforeReportDate)
    .order("report_date", { ascending: false })
    .order("recorded_at", { ascending: false });

  if (error) {
    throw new Error(
      `Kunde inte hämta föregående KPI-rapporter: ${error.message}`,
    );
  }

  const latestByKpi = new Map<string, KpiHistoryRow>();
  for (const row of data ?? []) {
    if (!latestByKpi.has(row.kpi_id)) {
      latestByKpi.set(row.kpi_id, row);
    }
  }
  return [...latestByKpi.values()];
}

/**
 * Report rows for KPIs with report_date in [startDate, endDate] (inclusive).
 * Newest report_date first per query order; callers may pick latest per kpi.
 */
export async function fetchKpiHistoryInReportDateRangeForKpis(
  kpiIds: string[],
  startDate: string,
  endDate: string,
): Promise<KpiHistoryRow[]> {
  if (kpiIds.length === 0) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpi_history")
    .select(kpiHistorySelect)
    .in("kpi_id", kpiIds)
    .is("archived_at", null)
    .gte("report_date", startDate)
    .lte("report_date", endDate)
    .order("report_date", { ascending: false })
    .order("recorded_at", { ascending: false });

  if (error) {
    throw new Error(
      `Kunde inte hämta KPI-rapporter för period: ${error.message}`,
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
    .is("archived_at", null)
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
    .is("archived_at", null)
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
    .is("archived_at", null)
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
