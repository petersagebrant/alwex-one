import { createClient } from "@/lib/supabase/server";

export type GoalRow = {
  id: string;
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  status: string;
  target_value: string | null;
  current_value: string | null;
  deadline: string | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
};

export type InsertGoalInput = {
  business_area_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  status: string;
  target_value: string | null;
  current_value: string | null;
  deadline: string | null;
  progress: number | null;
};

export async function fetchGoalsByBusinessAreaId(
  businessAreaId: string,
): Promise<GoalRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("goals")
    .select(
      "id, business_area_id, title, description, owner, status, target_value, current_value, deadline, progress, created_at, updated_at",
    )
    .eq("business_area_id", businessAreaId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta goals: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchAllGoals(): Promise<GoalRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("goals")
    .select(
      "id, business_area_id, title, description, owner, status, target_value, current_value, deadline, progress, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

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
    .select(
      "id, business_area_id, title, description, owner, status, target_value, current_value, deadline, progress, created_at, updated_at",
    )
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
    .select(
      "id, business_area_id, title, description, owner, status, target_value, current_value, deadline, progress, created_at, updated_at",
    )
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
    .select(
      "id, business_area_id, title, description, owner, status, target_value, current_value, deadline, progress, created_at, updated_at",
    )
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera goal: ${error.message}`);
  }

  return data;
}
