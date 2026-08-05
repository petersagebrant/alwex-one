import { createClient } from "@/lib/supabase/server";

export type ActivityCommentRow = {
  id: string;
  activity_id: string;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type InsertActivityCommentInput = {
  activity_id: string;
  author_name: string;
  content: string;
};

const commentSelect =
  "id, activity_id, author_name, content, created_at, updated_at";

export async function fetchCommentsByActivityId(
  activityId: string,
): Promise<ActivityCommentRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_comments")
    .select(commentSelect)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta activity_comments: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchAllActivityComments(): Promise<ActivityCommentRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_comments")
    .select(commentSelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Kunde inte hämta activity_comments: ${error.message}`);
  }

  return data ?? [];
}

export async function insertActivityComment(
  input: InsertActivityCommentInput,
): Promise<ActivityCommentRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_comments")
    .insert(input)
    .select(commentSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara activity_comment: ${error.message}`);
  }

  return data;
}
