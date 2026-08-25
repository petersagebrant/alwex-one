"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperationalWriter } from "@/lib/auth/require-user";
import { parseGoalFormValues } from "@/lib/goals/validateGoalForm";
import {
  archiveGoal,
  createGoal,
  unarchiveGoal,
  updateGoal,
} from "@/services/goals";

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
    goalKind: firstParam(formData.get("goalKind")),
    lifecycle: firstParam(formData.get("lifecycle")),
    deadline: firstParam(formData.get("deadline")),
    targetValue: firstParam(formData.get("targetValue")),
    currentValue: firstParam(formData.get("currentValue")),
    statusValue: firstParam(formData.get("status")),
  };
}

export async function createGoalAction(formData: FormData) {
  await requireOperationalWriter();
  const fields = readGoalFields(formData);
  const areaId = fields.businessAreaId.trim() || null;
  const parsed = parseGoalFormValues(fields);

  if (!parsed.ok) {
    redirect(goalsNewPath(areaId, parsed.error));
  }

  try {
    await createGoal({
      businessAreaId: parsed.value.businessAreaId,
      title: parsed.value.title,
      description: parsed.value.description,
      ownerId: parsed.value.ownerId,
      goalKind: parsed.value.goalKind,
      lifecycle: parsed.value.lifecycle,
      deadline: parsed.value.deadline,
      targetValue: parsed.value.targetValue,
      currentValue: parsed.value.currentValue,
      status: parsed.value.status,
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

  const parsed = parseGoalFormValues(fields);
  if (!parsed.ok) {
    redirect(goalsEditPath(id, parsed.error));
  }

  try {
    await updateGoal({
      id,
      businessAreaId: parsed.value.businessAreaId,
      title: parsed.value.title,
      description: parsed.value.description,
      ownerId: parsed.value.ownerId,
      goalKind: parsed.value.goalKind,
      lifecycle: parsed.value.lifecycle,
      deadline: parsed.value.deadline,
      targetValue: parsed.value.targetValue,
      currentValue: parsed.value.currentValue,
      status: parsed.value.status,
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
