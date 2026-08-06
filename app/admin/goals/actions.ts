"use server";

import { redirect } from "next/navigation";
import { createGoal, updateGoal } from "@/services/goals";
import type { StatusTone } from "@/types";

function isStatusTone(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

function readGoalFields(formData: FormData) {
  return {
    businessAreaId: String(formData.get("businessAreaId") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    owner: String(formData.get("owner") ?? ""),
    deadline: String(formData.get("deadline") ?? ""),
    targetValue: String(formData.get("targetValue") ?? ""),
    currentValue: String(formData.get("currentValue") ?? ""),
    progressValue: String(formData.get("progress") ?? ""),
    statusValue: String(formData.get("status") ?? ""),
  };
}

export async function createGoalAction(formData: FormData) {
  const fields = readGoalFields(formData);

  if (!fields.businessAreaId.trim()) {
    redirect("/admin/goals?new=1&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.");
  }

  if (!fields.title.trim()) {
    redirect("/admin/goals?new=1&error=Titel%20%C3%A4r%20obligatorisk.");
  }

  if (!isStatusTone(fields.statusValue)) {
    redirect("/admin/goals?new=1&error=Ogiltig%20status.");
  }

  const progress =
    fields.progressValue.trim() === ""
      ? undefined
      : Number(fields.progressValue);

  try {
    await createGoal({
      businessAreaId: fields.businessAreaId,
      title: fields.title,
      description: fields.description,
      owner: fields.owner,
      deadline: fields.deadline || undefined,
      targetValue: fields.targetValue,
      currentValue: fields.currentValue,
      progress: Number.isFinite(progress) ? progress : undefined,
      status: fields.statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara målet.";
    redirect(`/admin/goals?new=1&error=${encodeURIComponent(message)}`);
  }

  redirect("/admin/goals");
}

export async function updateGoalAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const fields = readGoalFields(formData);

  if (!id) {
    redirect("/admin/goals?error=Saknar%20m%C3%A5l-id.");
  }

  if (!fields.businessAreaId.trim()) {
    redirect(
      `/admin/goals?edit=${encodeURIComponent(id)}&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.`,
    );
  }

  if (!fields.title.trim()) {
    redirect(
      `/admin/goals?edit=${encodeURIComponent(id)}&error=Titel%20%C3%A4r%20obligatorisk.`,
    );
  }

  if (!isStatusTone(fields.statusValue)) {
    redirect(
      `/admin/goals?edit=${encodeURIComponent(id)}&error=Ogiltig%20status.`,
    );
  }

  const progress =
    fields.progressValue.trim() === ""
      ? undefined
      : Number(fields.progressValue);

  try {
    await updateGoal({
      id,
      businessAreaId: fields.businessAreaId,
      title: fields.title,
      description: fields.description,
      owner: fields.owner,
      deadline: fields.deadline || undefined,
      targetValue: fields.targetValue,
      currentValue: fields.currentValue,
      progress: Number.isFinite(progress) ? progress : undefined,
      status: fields.statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte uppdatera målet.";
    redirect(
      `/admin/goals?edit=${encodeURIComponent(id)}&error=${encodeURIComponent(message)}`,
    );
  }

  redirect(`/admin/goals/${encodeURIComponent(id)}`);
}
