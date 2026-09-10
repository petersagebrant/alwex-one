import { createClient } from "@/lib/supabase/server";

export type ActivityRow = {
  id: string;
  business_area_id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  owner: string | null;
  owner_id: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  operational_report_id: string | null;
  source_kpi_id: string | null;
  requires_escalation: boolean;
  escalated_at: string | null;
  escalation_note: string | null;
};

export type InsertActivityInput = {
  business_area_id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  owner: string | null;
  owner_id: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  completed_at: string | null;
  operational_report_id?: string | null;
  source_kpi_id?: string | null;
  requires_escalation?: boolean;
  escalated_at?: string | null;
  escalation_note?: string | null;
};

const activitySelect =
  "id, business_area_id, goal_id, title, description, owner, owner_id, status, priority, deadline, completed_at, created_at, updated_at, operational_report_id, source_kpi_id, requires_escalation, escalated_at, escalation_note";

export async function fetchAllActivities(): Promise<ActivityRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(activitySelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Kunde inte hämta activities: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchActivitiesByBusinessAreaId(
  businessAreaId: string,
): Promise<ActivityRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(activitySelect)
    .eq("business_area_id", businessAreaId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta activities: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchActivitiesByGoalId(
  goalId: string,
): Promise<ActivityRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(activitySelect)
    .eq("goal_id", goalId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta activities: ${error.message}`);
  }

  return data ?? [];
}

export async function insertActivity(
  input: InsertActivityInput,
): Promise<ActivityRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .insert(input)
    .select(activitySelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara activity: ${error.message}`);
  }

  return data;
}

export async function fetchActivityById(
  id: string,
): Promise<ActivityRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(activitySelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta activity: ${error.message}`);
  }

  return data;
}

export type UpdateActivityRowInput = {
  business_area_id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  owner: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type UpdateActivitySteeringRowInput = {
  owner?: string | null;
  owner_id?: string | null;
  deadline?: string | null;
  status?: string;
  completed_at?: string | null;
  requires_escalation?: boolean;
  escalated_at?: string | null;
  escalation_note?: string | null;
  updated_at: string;
};

export async function updateActivityRow(
  id: string,
  input: UpdateActivityRowInput,
): Promise<ActivityRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .update(input)
    .eq("id", id)
    .select(activitySelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera activity: ${error.message}`);
  }

  return data;
}

export async function updateActivitySteeringRow(
  id: string,
  input: UpdateActivitySteeringRowInput,
): Promise<ActivityRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .update(input)
    .eq("id", id)
    .select(activitySelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera activity: ${error.message}`);
  }

  return data;
}
