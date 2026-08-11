"use server";

import { redirect } from "next/navigation";
import { requireOperationalWriter } from "@/lib/auth/require-user";
import { parseNumeric } from "@/lib/kpi/parseNumeric";
import { createKPI, updateKPI } from "@/services/kpis";
import type {
  KpiDirection,
  KpiToleranceType,
  KpiTrend,
  StatusTone,
} from "@/types";

function isStatus(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

function isTrend(value: string): value is KpiTrend {
  return value === "Upp" || value === "Oförändrad" || value === "Ner";
}

function isDirection(value: string): value is KpiDirection {
  return (
    value === "HIGHER_IS_BETTER" ||
    value === "LOWER_IS_BETTER" ||
    value === "TARGET_IS_BEST"
  );
}

function isToleranceType(value: string): value is KpiToleranceType {
  return value === "PERCENT" || value === "ABSOLUTE";
}

type ReadKpiFieldsResult =
  | { ok: true; fields: {
      businessAreaId: string;
      name: string;
      category: string;
      targetValue: string;
      currentValue: string;
      unit: string;
      statusValue: string;
      trendValue: string;
      direction: KpiDirection | null;
      toleranceType: KpiToleranceType | null;
      yellowTolerance: number | null;
    } }
  | { ok: false; error: string };

function readKpiFields(formData: FormData): ReadKpiFieldsResult {
  const directionRaw = String(formData.get("direction") ?? "").trim();
  const toleranceTypeRaw = String(formData.get("toleranceType") ?? "").trim();
  const yellowToleranceRaw = String(formData.get("yellowTolerance") ?? "").trim();

  let direction: KpiDirection | null = null;
  if (directionRaw) {
    if (!isDirection(directionRaw)) {
      return { ok: false, error: "Ogiltig riktning." };
    }
    direction = directionRaw;
  }

  let toleranceType: KpiToleranceType | null = null;
  if (toleranceTypeRaw) {
    if (!isToleranceType(toleranceTypeRaw)) {
      return { ok: false, error: "Ogiltig toleranstyp." };
    }
    toleranceType = toleranceTypeRaw;
  }

  let yellowTolerance: number | null = null;
  if (yellowToleranceRaw) {
    const parsed = parseNumeric(yellowToleranceRaw);
    if (parsed === null || parsed < 0) {
      return { ok: false, error: "Ogiltig gul tolerans." };
    }
    yellowTolerance = parsed;
  }

  if (direction && yellowTolerance === null) {
    return {
      ok: false,
      error: "Ange gul tolerans när automatisk riktning är vald.",
    };
  }

  return {
    ok: true,
    fields: {
      businessAreaId: String(formData.get("businessAreaId") ?? ""),
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      targetValue: String(formData.get("targetValue") ?? ""),
      currentValue: String(formData.get("currentValue") ?? ""),
      unit: String(formData.get("unit") ?? ""),
      statusValue: String(formData.get("status") ?? ""),
      trendValue: String(formData.get("trend") ?? ""),
      direction,
      toleranceType,
      yellowTolerance,
    },
  };
}

export async function createKpiAction(formData: FormData) {
  await requireOperationalWriter();
  const parsed = readKpiFields(formData);

  if (!parsed.ok) {
    redirect(`/admin/kpis?new=1&error=${encodeURIComponent(parsed.error)}`);
  }

  const fields = parsed.fields;

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
      direction: fields.direction,
      toleranceType: fields.toleranceType,
      yellowTolerance: fields.yellowTolerance,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara KPI.";
    redirect(`/admin/kpis?new=1&error=${encodeURIComponent(message)}`);
  }

  redirect("/admin/kpis");
}

export async function updateKpiAction(formData: FormData) {
  await requireOperationalWriter();
  const id = String(formData.get("id") ?? "");
  const parsed = readKpiFields(formData);

  if (!id) {
    redirect("/admin/kpis?error=Saknar%20KPI-id.");
  }

  if (!parsed.ok) {
    redirect(
      `/admin/kpis?edit=${encodeURIComponent(id)}&error=${encodeURIComponent(parsed.error)}`,
    );
  }

  const fields = parsed.fields;

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
      direction: fields.direction,
      toleranceType: fields.toleranceType,
      yellowTolerance: fields.yellowTolerance,
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
