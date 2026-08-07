"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createActivity, updateActivity } from "@/services/activities";
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

function readActivityFields(formData: FormData) {
  return {
    businessAreaId: String(formData.get("businessAreaId") ?? ""),
    goalId: String(formData.get("goalId") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    owner: String(formData.get("owner") ?? ""),
    deadline: String(formData.get("deadline") ?? ""),
    priorityValue: String(formData.get("priority") ?? ""),
    statusValue: String(formData.get("status") ?? ""),
  };
}

export async function createActivityAction(formData: FormData) {
  await requireUser();
  const fields = readActivityFields(formData);

  if (!fields.businessAreaId.trim()) {
    redirect(
      "/admin/activities?new=1&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.",
    );
  }

  if (!fields.title.trim()) {
    redirect("/admin/activities?new=1&error=Titel%20%C3%A4r%20obligatorisk.");
  }

  if (!isPriority(fields.priorityValue)) {
    redirect("/admin/activities?new=1&error=Ogiltig%20prioritet.");
  }

  if (!isStatus(fields.statusValue)) {
    redirect("/admin/activities?new=1&error=Ogiltig%20status.");
  }

  try {
    await createActivity({
      businessAreaId: fields.businessAreaId,
      goalId: fields.goalId || null,
      title: fields.title,
      description: fields.description,
      owner: fields.owner,
      deadline: fields.deadline || undefined,
      priority: fields.priorityValue,
      status: fields.statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara aktiviteten.";
    redirect(`/admin/activities?new=1&error=${encodeURIComponent(message)}`);
  }

  redirect("/admin/activities");
}

export async function updateActivityAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const fields = readActivityFields(formData);

  if (!id) {
    redirect("/admin/activities?error=Saknar%20aktivitets-id.");
  }

  if (!fields.businessAreaId.trim()) {
    redirect(
      `/admin/activities?edit=${encodeURIComponent(id)}&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.`,
    );
  }

  if (!fields.title.trim()) {
    redirect(
      `/admin/activities?edit=${encodeURIComponent(id)}&error=Titel%20%C3%A4r%20obligatorisk.`,
    );
  }

  if (!isPriority(fields.priorityValue)) {
    redirect(
      `/admin/activities?edit=${encodeURIComponent(id)}&error=Ogiltig%20prioritet.`,
    );
  }

  if (!isStatus(fields.statusValue)) {
    redirect(
      `/admin/activities?edit=${encodeURIComponent(id)}&error=Ogiltig%20status.`,
    );
  }

  try {
    await updateActivity({
      id,
      businessAreaId: fields.businessAreaId,
      goalId: fields.goalId || null,
      title: fields.title,
      description: fields.description,
      owner: fields.owner,
      deadline: fields.deadline || undefined,
      priority: fields.priorityValue,
      status: fields.statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Kunde inte uppdatera aktiviteten.";
    redirect(
      `/admin/activities?edit=${encodeURIComponent(id)}&error=${encodeURIComponent(message)}`,
    );
  }

  redirect(`/activities/${encodeURIComponent(id)}`);
}
