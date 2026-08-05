"use server";

import { redirect } from "next/navigation";
import { createGoal } from "@/services/goals";
import type { StatusTone } from "@/types";

function isStatusTone(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

export async function createGoalAction(formData: FormData) {
  const businessAreaId = String(formData.get("businessAreaId") ?? "");
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const owner = String(formData.get("owner") ?? "");
  const deadline = String(formData.get("deadline") ?? "");
  const targetValue = String(formData.get("targetValue") ?? "");
  const statusValue = String(formData.get("status") ?? "");

  if (!businessAreaId.trim()) {
    redirect("/admin/goals?new=1&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.");
  }

  if (!title.trim()) {
    redirect("/admin/goals?new=1&error=Titel%20%C3%A4r%20obligatorisk.");
  }

  if (!isStatusTone(statusValue)) {
    redirect("/admin/goals?new=1&error=Ogiltig%20status.");
  }

  try {
    await createGoal({
      businessAreaId,
      title,
      description,
      owner,
      deadline: deadline || undefined,
      targetValue,
      status: statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara målet.";
    redirect(`/admin/goals?new=1&error=${encodeURIComponent(message)}`);
  }

  redirect("/admin/goals");
}
