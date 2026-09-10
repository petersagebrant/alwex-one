import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import type {
  OperationalReportCategory,
  OperationalReportIncidentKind,
  OperationalReportPriority,
  OperationalReportStatus,
} from "@/types/operational-report";

export type OperationalReportRow = {
  id: string;
  created_at: string;
  haulier_name: string;
  business_area_id: string;
  body: string;
  priority: OperationalReportPriority;
  status: OperationalReportStatus;
  category: OperationalReportCategory;
  incident_kind: OperationalReportIncidentKind | null;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type OperationalReportAreaRow = {
  id: string;
  name: string;
};

const reportSelect =
  "id, created_at, haulier_name, business_area_id, body, priority, status, category, incident_kind, resolved_at, resolved_by";

export async function fetchOperationalReports(): Promise<OperationalReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operational_reports")
    .select(reportSelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Kunde inte hämta rapporter: ${error.message}`);
  }

  return (data ?? []) as OperationalReportRow[];
}

export async function fetchOperationalReportById(
  id: string,
): Promise<OperationalReportRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operational_reports")
    .select(reportSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta rapport: ${error.message}`);
  }

  return (data as OperationalReportRow | null) ?? null;
}

export async function updateOperationalReportStatusRow(
  id: string,
  status: OperationalReportStatus,
): Promise<OperationalReportRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operational_reports")
    .update({ status })
    .eq("id", id)
    .select(reportSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera status: ${error.message}`);
  }

  return data as OperationalReportRow;
}

export async function listPublicOperationalReportAreas(): Promise<
  OperationalReportAreaRow[]
> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("list_operational_report_areas");

  if (error) {
    throw new Error(`Kunde inte hämta affärsområden: ${error.message}`);
  }

  return (data ?? []) as OperationalReportAreaRow[];
}

export async function consumeOperationalReportRateLimit(
  ipHash: string,
): Promise<boolean> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc(
    "consume_operational_report_rate_limit",
    { p_ip_hash: ipHash },
  );

  if (error) {
    throw new Error(`Kunde inte kontrollera utskick: ${error.message}`);
  }

  return data === true;
}

export async function insertPublicOperationalReport(input: {
  haulier_name: string;
  business_area_id: string;
  body: string;
  priority: OperationalReportPriority;
  category: OperationalReportCategory;
  incident_kind: OperationalReportIncidentKind | null;
}): Promise<void> {
  const supabase = createAnonClient();
  const { error } = await supabase.from("operational_reports").insert({
    haulier_name: input.haulier_name,
    business_area_id: input.business_area_id,
    body: input.body,
    priority: input.priority,
    category: input.category,
    incident_kind: input.incident_kind,
    status: "ny",
    resolved_at: null,
    resolved_by: null,
  });

  if (error) {
    throw new Error(`Kunde inte skicka rapporten: ${error.message}`);
  }
}
