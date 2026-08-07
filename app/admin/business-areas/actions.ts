"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import {
  createBusinessArea,
  updateBusinessArea,
} from "@/services/businessAreas";
import type { StatusTone } from "@/types";

function isStatusTone(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

export async function createBusinessAreaAction(formData: FormData) {
  await requireUser();

  const name = String(formData.get("name") ?? "");
  const manager = String(formData.get("manager") ?? "");
  const description = String(formData.get("description") ?? "");
  const statusValue = String(formData.get("status") ?? "");

  if (!name.trim()) {
    redirect("/admin/business-areas?error=Namn%20%C3%A4r%20obligatoriskt.");
  }

  if (!isStatusTone(statusValue)) {
    redirect("/admin/business-areas?error=Ogiltig%20status.");
  }

  try {
    await createBusinessArea({
      name,
      manager,
      description,
      status: statusValue,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Kunde inte spara affärsområdet.";
    redirect(
      `/admin/business-areas?error=${encodeURIComponent(message)}`,
    );
  }

  redirect("/areas");
}

export async function updateBusinessAreaAction(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const manager = String(formData.get("manager") ?? "");
  const description = String(formData.get("description") ?? "");
  const statusValue = String(formData.get("status") ?? "");
  const vdComment = String(formData.get("vdComment") ?? "");

  const editPath = id
    ? `/admin/business-areas?edit=${encodeURIComponent(id)}`
    : "/admin/business-areas";

  if (!id) {
    redirect("/admin/business-areas?error=Saknar%20aff%C3%A4rsomr%C3%A5des-id.");
  }

  if (!name.trim()) {
    redirect(`${editPath}&error=Namn%20%C3%A4r%20obligatoriskt.`);
  }

  if (!isStatusTone(statusValue)) {
    redirect(`${editPath}&error=Ogiltig%20status.`);
  }

  let slug = "";

  try {
    const updated = await updateBusinessArea({
      id,
      name,
      manager,
      description,
      status: statusValue,
      vdComment,
    });
    slug = updated.slug;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Kunde inte uppdatera affärsområdet.";
    redirect(`${editPath}&error=${encodeURIComponent(message)}`);
  }

  redirect(`/areas/${encodeURIComponent(slug)}`);
}
