import { createClient } from "@/lib/supabase/server";

export type ActivityEscalationRow = {
  id: string;
  activity_id: string;
  question: string;
  asked_by: string | null;
  asked_by_name: string;
  asked_at: string;
  reply: string | null;
  replied_by: string | null;
  replied_by_name: string | null;
  replied_at: string | null;
  status: "open" | "answered";
};

const escalationSelect =
  "id, activity_id, question, asked_by, asked_by_name, asked_at, reply, replied_by, replied_by_name, replied_at, status";

export async function fetchEscalationsByActivityIds(
  activityIds: string[],
): Promise<ActivityEscalationRow[]> {
  if (activityIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_escalations")
    .select(escalationSelect)
    .in("activity_id", activityIds)
    .order("asked_at", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta eskaleringar: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchOpenEscalationRows(): Promise<ActivityEscalationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_escalations")
    .select(escalationSelect)
    .eq("status", "open")
    .order("asked_at", { ascending: false });

  if (error) {
    throw new Error(`Kunde inte hämta öppna eskaleringar: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchEscalationById(
  id: string,
): Promise<ActivityEscalationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_escalations")
    .select(escalationSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta eskalering: ${error.message}`);
  }

  return data;
}

export async function insertActivityEscalation(input: {
  activity_id: string;
  question: string;
  asked_by: string | null;
  asked_by_name: string;
  asked_at: string;
  status: "open";
}): Promise<ActivityEscalationRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_escalations")
    .insert(input)
    .select(escalationSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara eskalering: ${error.message}`);
  }

  return data;
}

export async function updateActivityEscalationReply(
  id: string,
  input: {
    reply: string;
    replied_by: string | null;
    replied_by_name: string;
    replied_at: string;
    status: "answered";
  },
): Promise<ActivityEscalationRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_escalations")
    .update(input)
    .eq("id", id)
    .select(escalationSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara svar: ${error.message}`);
  }

  return data;
}