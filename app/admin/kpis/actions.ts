"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireBusinessAreaManager,
  requireOperationalWriter,
} from "@/lib/auth/require-user";
import { validateGreenYellowTolerances } from "@/lib/kpi/computeStatus";
import { isKpiCalcOperator, type KpiCalcOperator } from "@/lib/kpi/calculated";
import { isKpiKind, type KpiKind } from "@/lib/kpi/kind";
import { parseNumeric } from "@/lib/kpi/parseNumeric";
import {
  archiveKPI,
  createKPI,
  unarchiveKPI,
  updateKPI,
} from "@/services/kpis";
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
  | {
      ok: true;
      fields: {
        businessAreaId: string;
        name: string;
        category: string;
        targetValue: string;
        currentValue: string;
        unit: string;
        statusValue: string;
        trendValue: string;
        kind: KpiKind;
        direction: KpiDirection | null;
        toleranceType: KpiToleranceType | null;
        greenTolerance: number | null;
        yellowTolerance: number | null;
        calcOperator: KpiCalcOperator | null;
        calcNumeratorKpiId: string | null;
        calcDenominatorKpiId: string | null;
      };
    }
  | { ok: false; error: string };

function readKpiFields(formData: FormData): ReadKpiFieldsResult {
  const kindRaw = String(formData.get("kpiKind") ?? "TARGET").trim();
  if (!isKpiKind(kindRaw)) {
    return { ok: false, error: "Ogiltig KPI-typ." };
  }
  const kind = kindRaw;

  if (kind === "STATISTIC") {
    return {
      ok: true,
      fields: {
        businessAreaId: String(formData.get("businessAreaId") ?? ""),
        name: String(formData.get("name") ?? ""),
        category: String(formData.get("category") ?? ""),
        targetValue: "",
        currentValue: String(formData.get("currentValue") ?? ""),
        unit: String(formData.get("unit") ?? ""),
        statusValue: "Gul",
        trendValue: String(formData.get("trend") ?? "Oförändrad"),
        kind,
        direction: null,
        toleranceType: null,
        greenTolerance: null,
        yellowTolerance: null,
        calcOperator: null,
        calcNumeratorKpiId: null,
        calcDenominatorKpiId: null,
      },
    };
  }

  if (kind === "CALCULATED") {
    const calcOperatorRaw = String(formData.get("calcOperator") ?? "DIVIDE").trim();
    if (!isKpiCalcOperator(calcOperatorRaw)) {
      return { ok: false, error: "Ogiltig beräkningsoperator." };
    }
    const calcNumeratorKpiId = String(
      formData.get("calcNumeratorKpiId") ?? "",
    ).trim();
    const calcDenominatorKpiId = String(
      formData.get("calcDenominatorKpiId") ?? "",
    ).trim();
    if (!calcNumeratorKpiId || !calcDenominatorKpiId) {
      return { ok: false, error: "Välj täljare och nämnare." };
    }

    return {
      ok: true,
      fields: {
        businessAreaId: String(formData.get("businessAreaId") ?? ""),
        name: String(formData.get("name") ?? ""),
        category: String(formData.get("category") ?? ""),
        targetValue: "",
        currentValue: "",
        unit: String(formData.get("unit") ?? ""),
        statusValue: "Gul",
        trendValue: String(formData.get("trend") ?? "Oförändrad"),
        kind,
        direction: null,
        toleranceType: null,
        greenTolerance: null,
        yellowTolerance: null,
        calcOperator: calcOperatorRaw,
        calcNumeratorKpiId,
        calcDenominatorKpiId,
      },
    };
  }

  const directionRaw = String(formData.get("direction") ?? "").trim();
  const toleranceTypeRaw = String(formData.get("toleranceType") ?? "").trim();
  const greenToleranceRaw = String(formData.get("greenTolerance") ?? "").trim();
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

  let greenTolerance: number | null = null;
  if (greenToleranceRaw) {
    const parsed = parseNumeric(greenToleranceRaw);
    if (parsed === null || parsed < 0) {
      return { ok: false, error: "Ogiltig grön tolerans." };
    }
    greenTolerance = parsed;
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

  const toleranceError = validateGreenYellowTolerances(
    greenTolerance,
    yellowTolerance,
  );
  if (toleranceError) {
    return { ok: false, error: toleranceError };
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
      kind,
      direction,
      toleranceType,
      greenTolerance,
      yellowTolerance,
      calcOperator: null,
      calcNumeratorKpiId: null,
      calcDenominatorKpiId: null,
    },
  };
}

function fallbackStatusForKind(kind: KpiKind, statusValue: string): StatusTone {
  if (kind === "STATISTIC" || kind === "CALCULATED") {
    return "Gul";
  }
  return statusValue as StatusTone;
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

  if (fields.kind === "TARGET" && !isStatus(fields.statusValue)) {
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
      status: fallbackStatusForKind(fields.kind, fields.statusValue),
      trend: fields.trendValue,
      kind: fields.kind,
      direction: fields.direction,
      toleranceType: fields.toleranceType,
      greenTolerance: fields.greenTolerance,
      yellowTolerance: fields.yellowTolerance,
      calcOperator: fields.calcOperator,
      calcNumeratorKpiId: fields.calcNumeratorKpiId,
      calcDenominatorKpiId: fields.calcDenominatorKpiId,
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

  if (fields.kind === "TARGET" && !isStatus(fields.statusValue)) {
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
      status: fallbackStatusForKind(fields.kind, fields.statusValue),
      trend: fields.trendValue,
      kind: fields.kind,
      direction: fields.direction,
      toleranceType: fields.toleranceType,
      greenTolerance: fields.greenTolerance,
      yellowTolerance: fields.yellowTolerance,
      calcOperator: fields.calcOperator,
      calcNumeratorKpiId: fields.calcNumeratorKpiId,
      calcDenominatorKpiId: fields.calcDenominatorKpiId,
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

export type ArchiveKpiResult =
  | { ok: true }
  | { ok: false; error: string };

/** VD/admin only — soft-archive KPI (history preserved). */
export async function archiveKpiAction(
  kpiId: string,
): Promise<ArchiveKpiResult> {
  await requireBusinessAreaManager();
  const id = kpiId.trim();
  if (!id) {
    return { ok: false, error: "Saknar KPI-id." };
  }

  try {
    await archiveKPI(id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte arkivera KPI.";
    return { ok: false, error: message };
  }

  revalidatePath("/admin/kpis");
  revalidatePath(`/admin/kpis/${id}`);
  revalidatePath("/report/kpis");
  revalidatePath("/");
  return { ok: true };
}

/** VD/admin only — restore archived KPI to active lists. */
export async function unarchiveKpiAction(
  kpiId: string,
): Promise<ArchiveKpiResult> {
  await requireBusinessAreaManager();
  const id = kpiId.trim();
  if (!id) {
    return { ok: false, error: "Saknar KPI-id." };
  }

  try {
    await unarchiveKPI(id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte återaktivera KPI.";
    return { ok: false, error: message };
  }

  revalidatePath("/admin/kpis");
  revalidatePath(`/admin/kpis/${id}`);
  revalidatePath("/report/kpis");
  revalidatePath("/");
  return { ok: true };
}
