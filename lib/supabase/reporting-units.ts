import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export type ReportingUnitRow = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  default_business_area_id: string | null;
  sort_order: number;
  created_at: string;
};

export type PublicReportingUnitRow = {
  id: string;
  name: string;
  default_business_area_id: string | null;
};

export type InsertReportingUnitInput = {
  name: string;
  code: string;
  is_active: boolean;
  default_business_area_id: string | null;
  sort_order: number;
};

export type UpdateReportingUnitRowInput = {
  name: string;
  code: string;
  is_active: boolean;
  default_business_area_id: string | null;
  sort_order: number;
};

const reportingUnitSelect =
  "id, name, code, is_active, default_business_area_id, sort_order, created_at";

export async function listPublicReportingUnits(): Promise<
  PublicReportingUnitRow[]
> {
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("list_reporting_units");

  if (error) {
    throw new Error(`Kunde inte hämta rapportenheter: ${error.message}`);
  }

  return (data ?? []) as PublicReportingUnitRow[];
}

export async function fetchReportingUnits(): Promise<ReportingUnitRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reporting_units")
    .select(reportingUnitSelect)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta rapportenheter: ${error.message}`);
  }

  return (data ?? []) as ReportingUnitRow[];
}

export async function fetchReportingUnitById(
  id: string,
): Promise<ReportingUnitRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reporting_units")
    .select(reportingUnitSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta rapportenhet: ${error.message}`);
  }

  return (data as ReportingUnitRow | null) ?? null;
}

export async function reportingUnitCodeExists(
  code: string,
  exceptId?: string,
): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase
    .from("reporting_units")
    .select("id")
    .eq("code", code);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Kunde inte kontrollera kod: ${error.message}`);
  }

  return Boolean(data);
}

export async function insertReportingUnit(
  input: InsertReportingUnitInput,
): Promise<ReportingUnitRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reporting_units")
    .insert({
      name: input.name,
      code: input.code,
      is_active: input.is_active,
      default_business_area_id: input.default_business_area_id,
      sort_order: input.sort_order,
    })
    .select(reportingUnitSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara rapportenheten: ${error.message}`);
  }

  return data as ReportingUnitRow;
}

export async function updateReportingUnitRow(
  id: string,
  input: UpdateReportingUnitRowInput,
): Promise<ReportingUnitRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reporting_units")
    .update({
      name: input.name,
      code: input.code,
      is_active: input.is_active,
      default_business_area_id: input.default_business_area_id,
      sort_order: input.sort_order,
    })
    .eq("id", id)
    .select(reportingUnitSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera rapportenheten: ${error.message}`);
  }

  return data as ReportingUnitRow;
}
