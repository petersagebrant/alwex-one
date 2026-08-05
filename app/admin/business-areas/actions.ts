"use server";

import { redirect } from "next/navigation";
import { createBusinessArea } from "@/services/businessAreas";
import type { StatusTone } from "@/types";

function isStatusTone(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

export async function createBusinessAreaAction(formData: FormData) {
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
