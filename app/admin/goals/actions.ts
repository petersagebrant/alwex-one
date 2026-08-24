"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperationalWriter } from "@/lib/auth/require-user";
import {
  archiveGoal,
  createGoal,
  unarchiveGoal,
  updateGoal,
} from "@/services/goals";
import type { StatusTone } from "@/types";

function isStatusTone(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

function firstParam(value: FormDataEntryValue | null): string {
  return String(value ?? "");
}

function goalsNewPath(areaId: string | null, error?: string): string {
  const params = new URLSearchParams();
  params.set("new", "1");
  if (areaId) {
    params.set("area", areaId);
  }
  if (error) {
    params.set("error", error);
  }
  return `/admin/goals?${params.toString()}`;
}

function goalsEditPath(id: string, error?: string): string {
  const params = new URLSearchParams();
  params.set("edit", id);
  if (error) {
    params.set("error", error);
  }
  return `/admin/goals?${params.toString()}`;
}

function readGoalFields(formData: FormData) {
  return {
    businessAreaId: firstParam(formData.get("businessAreaId")),
    title: firstParam(formData.get("title")),
    description: firstParam(formData.get("description")),
    ownerId: firstParam(formData.get("ownerId")),
    deadline: firstParam(formData.get("deadline")),
    targetValue: firstParam(formData.get("targetValue")),
    currentValue: firstParam(formData.get("currentValue")),
    progressValue: firstParam(formData.get("progress")),
    statusValue: firstParam(formData.get("status")),
  };
}

export async function createGoalAction(formData: FormData) {
  await requireOperationalWriter();
  const fields = readGoalFields(formData);
  const areaId = fields.businessAreaId.trim() || null;

  if (!fields.businessAreaId.trim()) {
    redirect(goalsNewPath(null, "Välj ett affärsområde."));
  }

  if (!fields.title.trim()) {
    redirect(goalsNewPath(areaId, "Titel är obligatorisk."));
  }

  if (!isStatusTone(fields.statusValue)) {
    redirect(goalsNewPath(areaId, "Ogiltig status."));
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
      ownerId: fields.ownerId,
      deadline: fields.deadline || undefined,
      targetValue: fields.targetValue,
      currentValue: fields.currentValue,
      progress: Number.isFinite(progress) ? progress : undefined,
      status: fields.statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara målet.";
    redirect(goalsNewPath(areaId, message));
  }

  revalidatePath("/admin/goals");
  revalidatePath("/");
  revalidatePath("/areas");
  redirect("/admin/goals");
}

export async function updateGoalAction(formData: FormData) {
  await requireOperationalWriter();
  const id = firstParam(formData.get("id"));
  const fields = readGoalFields(formData);

  if (!id) {
    redirect("/admin/goals?error=Saknar%20m%C3%A5l-id.");
  }

  if (!fields.businessAreaId.trim()) {
    redirect(goalsEditPath(id, "Välj ett affärsområde."));
  }

  if (!fields.title.trim()) {
    redirect(goalsEditPath(id, "Titel är obligatorisk."));
  }

  if (!isStatusTone(fields.statusValue)) {
    redirect(goalsEditPath(id, "Ogiltig status."));
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
      ownerId: fields.ownerId,
      deadline: fields.deadline || undefined,
      targetValue: fields.targetValue,
      currentValue: fields.currentValue,
      progress: Number.isFinite(progress) ? progress : undefined,
      status: fields.statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte uppdatera målet.";
    redirect(goalsEditPath(id, message));
  }

  revalidatePath("/admin/goals");
  revalidatePath(`/admin/goals/${id}`);
  revalidatePath("/");
  revalidatePath("/areas");
  redirect(`/admin/goals/${encodeURIComponent(id)}`);
}

export type ArchiveGoalResult =
  | { ok: true }
  | { ok: false; error: string };

/** VD/admin all areas; AO-chef own area — same as create/edit. */
export async function archiveGoalAction(
  goalId: string,
): Promise<ArchiveGoalResult> {
  await requireOperationalWriter();
  const id = goalId.trim();
  if (!id) {
    return { ok: false, error: "Saknar mål-id." };
  }

  try {
    await archiveGoal(id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte arkivera målet.";
    return { ok: false, error: message };
  }

  revalidatePath("/admin/goals");
  revalidatePath(`/admin/goals/${id}`);
  revalidatePath("/");
  revalidatePath("/areas");
  return { ok: true };
}

/** Same writers as archive. */
export async function unarchiveGoalAction(
  goalId: string,
): Promise<ArchiveGoalResult> {
  await requireOperationalWriter();
  const id = goalId.trim();
  if (!id) {
    return { ok: false, error: "Saknar mål-id." };
  }

  try {
    await unarchiveGoal(id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte återaktivera målet.";
    return { ok: false, error: message };
  }

  revalidatePath("/admin/goals");
  revalidatePath(`/admin/goals/${id}`);
  revalidatePath("/");
  revalidatePath("/areas");
  return { ok: true };
}
