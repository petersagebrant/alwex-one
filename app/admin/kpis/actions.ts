"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createKPI, updateKPI } from "@/services/kpis";
import type { KpiTrend, StatusTone } from "@/types";

function isStatus(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

function isTrend(value: string): value is KpiTrend {
  return value === "Upp" || value === "Oförändrad" || value === "Ner";
}

function readKpiFields(formData: FormData) {
  return {
    businessAreaId: String(formData.get("businessAreaId") ?? ""),
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    targetValue: String(formData.get("targetValue") ?? ""),
    currentValue: String(formData.get("currentValue") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    statusValue: String(formData.get("status") ?? ""),
    trendValue: String(formData.get("trend") ?? ""),
  };
}

export async function createKpiAction(formData: FormData) {
  await requireUser();
  const fields = readKpiFields(formData);

  if (!fields.businessAreaId.trim()) {
    redirect(
      "/admin/kpis?new=1&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.",
    );
  }

  if (!fields.name.trim()) {
    redirect("/admin/kpis?new=1&error=Namn%20%C3%A4r%20obligatoriskt.");
  }

  if (!isStatus(fields.statusValue)) {
    redirect("/admin/kpis?new=1&error=Ogiltig%20status.");
  }

  if (!isTrend(fields.trendValue)) {
    redirect("/admin/kpis?new=1&error=Ogiltig%20trend.");
  }

  try {
    await createKPI({
      businessAreaId: fields.businessAreaId,
      name: fields.name,
      category: fields.category,
      targetValue: fields.targetValue,
      currentValue: fields.currentValue,
      unit: fields.unit,
      status: fields.statusValue,
      trend: fields.trendValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara KPI.";
    redirect(`/admin/kpis?new=1&error=${encodeURIComponent(message)}`);
  }

  redirect("/admin/kpis");
}

export async function updateKpiAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const fields = readKpiFields(formData);

  if (!id) {
    redirect("/admin/kpis?error=Saknar%20KPI-id.");
  }

  if (!fields.businessAreaId.trim()) {
    redirect(
      `/admin/kpis?edit=${encodeURIComponent(id)}&error=V%C3%A4lj%20ett%20aff%C3%A4rsomr%C3%A5de.`,
    );
  }

  if (!fields.name.trim()) {
    redirect(
      `/admin/kpis?edit=${encodeURIComponent(id)}&error=Namn%20%C3%A4r%20obligatoriskt.`,
    );
  }

  if (!isStatus(fields.statusValue)) {
    redirect(
      `/admin/kpis?edit=${encodeURIComponent(id)}&error=Ogiltig%20status.`,
    );
  }

  if (!isTrend(fields.trendValue)) {
    redirect(
      `/admin/kpis?edit=${encodeURIComponent(id)}&error=Ogiltig%20trend.`,
    );
  }

  try {
    await updateKPI({
      id,
      businessAreaId: fields.businessAreaId,
      name: fields.name,
      category: fields.category,
      targetValue: fields.targetValue,
      currentValue: fields.currentValue,
      unit: fields.unit,
      status: fields.statusValue,
      trend: fields.trendValue,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte uppdatera KPI.";
    redirect(
      `/admin/kpis?edit=${encodeURIComponent(id)}&error=${encodeURIComponent(message)}`,
    );
  }

  redirect("/admin/kpis");
}
