import { createClient } from "@/lib/supabase/server";

export type GoalRow = {
  id: string;
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  owner_id: string | null;
  status: string;
  target_value: string | null;
  current_value: string | null;
  deadline: string | null;
  progress: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertGoalInput = {
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  owner_id: string | null;
  status: string;
  target_value: string | null;
  current_value: string | null;
  deadline: string | null;
  progress: number | null;
};

export type FetchGoalsOptions = {
  /** Default false — operational views exclude archived goals. */
  includeArchived?: boolean;
};

const goalSelect =
  "id, business_area_id, title, description, owner, owner_id, status, target_value, current_value, deadline, progress, archived_at, created_at, updated_at";

export async function fetchGoalsByBusinessAreaId(
  businessAreaId: string,
  options?: FetchGoalsOptions,
): Promise<GoalRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("goals")
    .select(goalSelect)
    .eq("business_area_id", businessAreaId)
    .order("created_at", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Kunde inte hämta goals: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchAllGoals(
  options?: FetchGoalsOptions,
): Promise<GoalRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("goals")
    .select(goalSelect)
    .order("created_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Kunde inte hämta goals: ${error.message}`);
  }

  return data ?? [];
}

export async function insertGoal(input: InsertGoalInput): Promise<GoalRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("goals")
    .insert(input)
    .select(goalSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara goal: ${error.message}`);
  }

  return data;
}

export type UpdateGoalRowInput = {
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  owner_id: string | null;
  status: string;
  target_value: string | null;
  current_value: string | null;
  deadline: string | null;
  progress: number | null;
  updated_at: string;
};

export async function fetchGoalById(id: string): Promise<GoalRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("goals")
    .select(goalSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta goal: ${error.message}`);
  }

  return data;
}

export async function updateGoalRow(
  id: string,
  input: UpdateGoalRowInput,
): Promise<GoalRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("goals")
    .update(input)
    .eq("id", id)
    .select(goalSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera goal: ${error.message}`);
  }

  return data;
}

export async function updateGoalArchivedAt(
  id: string,
  archivedAt: string | null,
): Promise<GoalRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("goals")
    .update({
      archived_at: archivedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(goalSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera mål-arkivering: ${error.message}`);
  }

  return data;
}
