"use server";

import { redirect } from "next/navigation";
import { requireDecisionWriter } from "@/lib/auth/require-user";
import {
  createDecision,
  markDecisionComplete,
  updateDecision,
} from "@/services/decisions";
import type { DecisionStatus } from "@/types";

function isStatus(value: string): value is DecisionStatus {
  return value === "Planerat" || value === "Pågår" || value === "Klart";
}

function readDecisionFields(formData: FormData) {
  return {
    businessAreaId: String(formData.get("businessAreaId") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    owner: String(formData.get("owner") ?? ""),
    meetingDate: String(formData.get("meetingDate") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    statusValue: String(formData.get("status") ?? ""),
  };
}

export async function createDecisionAction(formData: FormData) {
  await requireDecisionWriter();
  const fields = readDecisionFields(formData);

  if (!fields.businessAreaId.trim()) {
    redirect(
      "/admin/decisions?new=1&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.",
    );
  }

  if (!fields.title.trim()) {
    redirect("/admin/decisions?new=1&error=Titel%20%C3%A4r%20obligatorisk.");
  }

  if (!isStatus(fields.statusValue)) {
    redirect("/admin/decisions?new=1&error=Ogiltig%20status.");
  }

  let createdId = "";

  try {
    const created = await createDecision({
      businessAreaId: fields.businessAreaId,
      title: fields.title,
      description: fields.description,
      owner: fields.owner,
      meetingDate: fields.meetingDate || undefined,
      dueDate: fields.dueDate || undefined,
      status: fields.statusValue,
    });
    createdId = created.id;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara beslutet.";
    redirect(`/admin/decisions?new=1&error=${encodeURIComponent(message)}`);
  }

  redirect(`/admin/decisions/${encodeURIComponent(createdId)}`);
}

export async function updateDecisionAction(formData: FormData) {
  await requireDecisionWriter();
  const id = String(formData.get("id") ?? "");
  const fields = readDecisionFields(formData);

  if (!id) {
    redirect("/admin/decisions?error=Saknar%20besluts-id.");
  }

  if (!fields.businessAreaId.trim()) {
    redirect(
      `/admin/decisions?edit=${encodeURIComponent(id)}&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.`,
    );
  }

  if (!fields.title.trim()) {
    redirect(
      `/admin/decisions?edit=${encodeURIComponent(id)}&error=Titel%20%C3%A4r%20obligatorisk.`,
    );
  }

  if (!isStatus(fields.statusValue)) {
    redirect(
      `/admin/decisions?edit=${encodeURIComponent(id)}&error=Ogiltig%20status.`,
    );
  }

  try {
    await updateDecision({
      id,
      businessAreaId: fields.businessAreaId,
      title: fields.title,
      description: fields.description,
      owner: fields.owner,
      meetingDate: fields.meetingDate || undefined,
      dueDate: fields.dueDate || undefined,
      status: fields.statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte uppdatera beslutet.";
    redirect(
      `/admin/decisions?edit=${encodeURIComponent(id)}&error=${encodeURIComponent(message)}`,
    );
  }

  redirect(`/admin/decisions/${encodeURIComponent(id)}`);
}

export async function markDecisionCompleteAction(formData: FormData) {
  await requireDecisionWriter();
  const id = String(formData.get("id") ?? "");

  if (!id) {
    redirect("/admin/decisions?error=Saknar%20besluts-id.");
  }

  try {
    await markDecisionComplete(id);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Kunde inte markera beslutet som klart.";
    redirect(`/admin/decisions?error=${encodeURIComponent(message)}`);
  }

  redirect("/admin/decisions");
}
