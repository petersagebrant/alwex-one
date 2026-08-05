import { createClient } from "@/lib/supabase/server";

export type DecisionRow = {
  id: string;
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  meeting_date: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type InsertDecisionInput = {
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  meeting_date: string | null;
  due_date: string | null;
  status: string;
};

export type UpdateDecisionRowInput = {
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  meeting_date: string | null;
  due_date: string | null;
  status: string;
  updated_at: string;
};

const decisionSelect =
  "id, business_area_id, title, description, owner, meeting_date, due_date, status, created_at, updated_at";

export async function fetchAllDecisions(): Promise<DecisionRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .select(decisionSelect)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Kunde inte hämta decisions: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchDecisionById(
  id: string,
): Promise<DecisionRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .select(decisionSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta decision: ${error.message}`);
  }

  return data;
}

export async function insertDecision(
  input: InsertDecisionInput,
): Promise<DecisionRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .insert(input)
    .select(decisionSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara decision: ${error.message}`);
  }

  return data;
}

export async function updateDecisionRow(
  id: string,
  input: UpdateDecisionRowInput,
): Promise<DecisionRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .update(input)
    .eq("id", id)
    .select(decisionSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera decision: ${error.message}`);
  }

  return data;
}
