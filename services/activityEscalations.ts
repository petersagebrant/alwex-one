import type { AuthProfile } from "@/lib/auth/require-user";
import { profileAssignmentLabel } from "@/lib/goals/owner";
import {
  canAnswerEscalation,
  canEscalateActivity,
  canViewLeadershipEscalations,
} from "@/lib/operational-reports/permissions";
import { requiresEscalationFromHistory } from "@/lib/operational-reports/escalation";
import {
  fetchEscalationById,
  fetchEscalationsByActivityIds,
  fetchOpenEscalationRows,
  insertActivityEscalation,
  updateActivityEscalationReply,
  type ActivityEscalationRow,
} from "@/lib/supabase/activity-escalations";
import {
  fetchActivitiesByIds,
  fetchActivityById,
  updateActivitySteeringRow,
} from "@/lib/supabase/activities";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { fetchProfileById } from "@/lib/supabase/profiles";
import type { ActivityEscalation, LeadershipEscalationItem } from "@/types";

export function mapEscalationRow(row: ActivityEscalationRow): ActivityEscalation {
  return {
    id: row.id,
    activityId: row.activity_id,
    question: row.question,
    askedBy: row.asked_by,
    askedByName: row.asked_by_name,
    askedAt: row.asked_at,
    reply: row.reply,
    repliedBy: row.replied_by,
    repliedByName: row.replied_by_name,
    repliedAt: row.replied_at,
    status: row.status,
  };
}

export async function loadEscalationsByActivityIds(
  activityIds: string[],
): Promise<Map<string, ActivityEscalation[]>> {
  const rows = await fetchEscalationsByActivityIds(activityIds);
  const byActivity = new Map<string, ActivityEscalation[]>();
  for (const row of rows) {
    const current = byActivity.get(row.activity_id) ?? [];
    current.push(mapEscalationRow(row));
    byActivity.set(row.activity_id, current);
  }
  return byActivity;
}

async function resolveActorDisplayName(profile: AuthProfile): Promise<string> {
  const row = await fetchProfileById(profile.id);
  if (row) {
    return profileAssignmentLabel(row);
  }
  const emailName = profile.email?.split("@")[0]?.trim();
  return emailName || "Okänd";
}

export async function recordActivityEscalation(
  activityId: string,
  question: string,
  profile: AuthProfile,
): Promise<ActivityEscalation> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Skriv vad du behöver hjälp eller beslut med.");
  }

  const activity = await fetchActivityById(activityId);
  if (!activity) {
    throw new Error("Aktiviteten hittades inte.");
  }

  if (
    !canEscalateActivity(
      profile.role,
      profile.businessAreaId,
      activity.business_area_id,
    )
  ) {
    throw new Error("Du saknar behörighet att eskalera aktiviteten.");
  }

  const existing = await fetchEscalationsByActivityIds([activityId]);
  if (requiresEscalationFromHistory(existing)) {
    throw new Error("Aktiviteten har redan en obesvarad eskalering.");
  }

  const askedAt = new Date().toISOString();
  const askedByName = await resolveActorDisplayName(profile);
  const row = await insertActivityEscalation({
    activity_id: activityId,
    question: trimmed,
    asked_by: profile.id,
    asked_by_name: askedByName,
    asked_at: askedAt,
    status: "open",
  });

  await updateActivitySteeringRow(activityId, {
    requires_escalation: true,
    escalated_at: askedAt,
    escalation_note: trimmed,
    updated_at: askedAt,
  });

  return mapEscalationRow(row);
}

export async function answerActivityEscalation(
  escalationId: string,
  reply: string,
  profile: AuthProfile,
): Promise<ActivityEscalation> {
  const trimmed = reply.trim();
  if (!trimmed) {
    throw new Error("Skriv ett beslut eller svar.");
  }

  if (!canAnswerEscalation(profile.role)) {
    throw new Error("Du saknar behörighet att besvara eskaleringen.");
  }

  const existing = await fetchEscalationById(escalationId);
  if (!existing || existing.status !== "open") {
    throw new Error("Eskaleringen hittades inte.");
  }

  const activity = await fetchActivityById(existing.activity_id);
  if (!activity) {
    throw new Error("Aktiviteten hittades inte.");
  }

  const repliedAt = new Date().toISOString();
  const repliedByName = await resolveActorDisplayName(profile);
  const row = await updateActivityEscalationReply(escalationId, {
    reply: trimmed,
    replied_by: profile.id,
    replied_by_name: repliedByName,
    replied_at: repliedAt,
    status: "answered",
  });

  const remaining = await fetchEscalationsByActivityIds([existing.activity_id]);
  if (!requiresEscalationFromHistory(remaining)) {
    await updateActivitySteeringRow(existing.activity_id, {
      requires_escalation: false,
      updated_at: repliedAt,
    });
  }

  return mapEscalationRow(row);
}

export async function getOpenLeadershipEscalations(
  profile: AuthProfile,
): Promise<LeadershipEscalationItem[]> {
  if (!canViewLeadershipEscalations(profile.role)) {
    return [];
  }

  const [rows, areas] = await Promise.all([
    fetchOpenEscalationRows(),
    fetchBusinessAreas(),
  ]);
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const activityIds = [...new Set(rows.map((row) => row.activity_id))];
  const activities = await fetchActivitiesByIds(activityIds);
  const activityById = new Map(activities.map((row) => [row.id, row]));

  return rows.flatMap((row) => {
    const activity = activityById.get(row.activity_id);
    if (!activity) {
      return [];
    }
    return [
      {
        id: row.id,
        activityId: activity.id,
        activityTitle: activity.title,
        activityStatus: activity.status,
        businessAreaName:
          areaNames.get(activity.business_area_id) ?? "Okänt område",
        askedByName: row.asked_by_name,
        question: row.question,
        askedAt: row.asked_at,
      },
    ];
  });
}
