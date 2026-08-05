"use server";

import { redirect } from "next/navigation";
import { createActivity } from "@/services/activities";
import type { ActivityPriority, ActivityStatus } from "@/types";

function isStatus(value: string): value is ActivityStatus {
  return (
    value === "Ej påbörjad" ||
    value === "Pågår" ||
    value === "Klar" ||
    value === "Försenad"
  );
}

function isPriority(value: string): value is ActivityPriority {
  return value === "Låg" || value === "Normal" || value === "Hög";
}

export async function createActivityAction(formData: FormData) {
  const businessAreaId = String(formData.get("businessAreaId") ?? "");
  const goalId = String(formData.get("goalId") ?? "");
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const owner = String(formData.get("owner") ?? "");
  const deadline = String(formData.get("deadline") ?? "");
  const priorityValue = String(formData.get("priority") ?? "");
  const statusValue = String(formData.get("status") ?? "");

  if (!businessAreaId.trim()) {
    redirect(
      "/admin/activities?new=1&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.",
    );
  }

  if (!title.trim()) {
    redirect("/admin/activities?new=1&error=Titel%20%C3%A4r%20obligatorisk.");
  }

  if (!isPriority(priorityValue)) {
    redirect("/admin/activities?new=1&error=Ogiltig%20prioritet.");
  }

  if (!isStatus(statusValue)) {
    redirect("/admin/activities?new=1&error=Ogiltig%20status.");
  }

  try {
    await createActivity({
      businessAreaId,
      goalId: goalId || null,
      title,
      description,
      owner,
      deadline: deadline || undefined,
      priority: priorityValue,
      status: statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara aktiviteten.";
    redirect(`/admin/activities?new=1&error=${encodeURIComponent(message)}`);
  }

  redirect("/admin/activities");
}
