import {
  fetchAllActivityComments,
  fetchCommentsByActivityId,
  insertActivityComment,
} from "@/lib/supabase/activity-comments";
import { fetchActivityById } from "@/lib/supabase/activities";
import { recordAuditLog } from "@/services/auditLog";
import type {
  ActivityComment,
  CreateActivityCommentInput,
} from "@/types";

function mapCommentRow(row: {
  id: string;
  activity_id: string;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}): ActivityComment {
  return {
    id: row.id,
    activityId: row.activity_id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCommentsByActivityId(
  activityId: string,
): Promise<ActivityComment[]> {
  const rows = await fetchCommentsByActivityId(activityId);
  return rows.map(mapCommentRow);
}

export async function getAllActivityComments(): Promise<ActivityComment[]> {
  const rows = await fetchAllActivityComments();
  return rows.map(mapCommentRow);
}

export async function createActivityComment(
  input: CreateActivityCommentInput,
): Promise<ActivityComment> {
  const authorName = input.authorName.trim();
  const content = input.content.trim();

  if (!input.activityId) {
    throw new Error("activityId är obligatoriskt.");
  }

  if (!authorName) {
    throw new Error("Författare är obligatorisk.");
  }

  if (!content) {
    throw new Error("Kommentar är obligatorisk.");
  }

  const row = await insertActivityComment({
    activity_id: input.activityId,
    author_name: authorName,
    content,
  });

  const activity = await fetchActivityById(input.activityId);

  await recordAuditLog({
    entityType: "activity_comment",
    entityId: input.activityId,
    action: "commented",
    description: `Lade till kommentar på aktiviteten "${activity?.title ?? "okänd"}"`,
    actorName: authorName,
    businessAreaId: activity?.business_area_id ?? null,
  });

  return mapCommentRow(row);
}
