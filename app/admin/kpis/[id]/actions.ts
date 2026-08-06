"use server";

import { redirect } from "next/navigation";
import { addKPIHistoryEntry } from "@/services/kpiHistory";
import type { StatusTone } from "@/types";

function isStatus(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

export async function addKpiHistoryAction(formData: FormData) {
  const kpiId = String(formData.get("kpiId") ?? "").trim();
  const value = String(formData.get("value") ?? "");
  const statusValue = String(formData.get("status") ?? "");
  const comment = String(formData.get("comment") ?? "");
  const recordedAt = String(formData.get("recordedAt") ?? "");

  if (!kpiId) {
    redirect("/admin/kpis?error=Saknar%20KPI-id.");
  }

  if (!value.trim()) {
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent("Värde är obligatoriskt.")}`,
    );
  }

  if (!isStatus(statusValue)) {
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent("Ogiltig status.")}`,
    );
  }

  if (!recordedAt.trim()) {
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent("Datum är obligatoriskt.")}`,
    );
  }

  try {
    await addKPIHistoryEntry({
      kpiId,
      value,
      status: statusValue,
      comment,
      recordedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Kunde inte spara historikvärde.";
    redirect(
      `/admin/kpis/${encodeURIComponent(kpiId)}?error=${encodeURIComponent(message)}`,
    );
  }

  redirect(`/admin/kpis/${encodeURIComponent(kpiId)}`);
}
