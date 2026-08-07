"use server";

import { redirect } from "next/navigation";
import { requireOperationalWriter } from "@/lib/auth/require-user";
import { createActivityComment } from "@/services/activityComments";

export async function createActivityCommentAction(formData: FormData) {
  await requireOperationalWriter();
  const activityId = String(formData.get("activityId") ?? "");
  const authorName = String(formData.get("authorName") ?? "");
  const content = String(formData.get("content") ?? "");

  if (!activityId) {
    redirect("/admin/activities");
  }

  if (!authorName.trim() || !content.trim()) {
    redirect(
      `/activities/${activityId}?error=${encodeURIComponent(
        "Författare och kommentar krävs.",
      )}`,
    );
  }

  try {
    await createActivityComment({
      activityId,
      authorName,
      content,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Kunde inte spara kommentaren.";
    redirect(
      `/activities/${activityId}?error=${encodeURIComponent(message)}`,
    );
  }

  redirect(`/activities/${activityId}`);
}
