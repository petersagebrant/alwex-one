"use server";

import { revalidatePath } from "next/cache";
import {
  requireOperationalWriter,
  requireProfile,
} from "@/lib/auth/require-user";
import { computeKpiStatus } from "@/lib/kpi/computeStatus";
import {
  fetchBusinessAreaById,
  fetchBusinessAreaBySlug,
  fetchBusinessAreas,
} from "@/lib/supabase/business-areas";
import { fetchKpiById } from "@/lib/supabase/kpis";
import { getKpisForTodayReporting } from "@/services/kpiReporting";
import { upsertDailyKpiReport, toStockholmReportDate } from "@/services/kpiHistory";
import type { MyKpisForTodayReporting, StatusTone } from "@/types";

export type ReportDailyKpiResult =
  | { ok: true }
  | { ok: false; error: string };

export type LoadVdAreaReportingResult =
  | { ok: true; reporting: MyKpisForTodayReporting }
  | { ok: false; error: string };

/**
 * VD/admin: resolve area (id or slug) and load today's reporting.
 * Called from the client panel when the user changes selectedAreaId.
 */
export async function loadVdAreaReportingAction(
  areaParam: string,
): Promise<LoadVdAreaReportingResult> {
  const profile = await requireProfile();
  if (profile.role !== "vd" && profile.role !== "administrator") {
    return { ok: false, error: "Du saknar behörighet." };
  }

  const raw = areaParam.trim();
  if (!raw) {
    return { ok: false, error: "Inget affärsområde valt." };
  }

  const areas = await fetchBusinessAreas().catch(() => []);
  const fromList = areas.find((area) => area.id === raw || area.slug === raw);
  const area =
    fromList ??
    (await fetchBusinessAreaById(raw).catch(() => null)) ??
    (await fetchBusinessAreaBySlug(raw).catch(() => null));

  if (!area) {
    return {
      ok: false,
      error: "Kunde inte hitta valt affärsområde. Välj igen i listan.",
    };
  }

  const reporting = await getKpisForTodayReporting(area.id, {
    businessAreaName: area.name,
  });

  return { ok: true, reporting };
}

function isStatus(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

/**
 * Save or update today's daily KPI report.
 * AO-chef: own business_area_id only. VD/admin: any area (operational write).
 * Uses upsertDailyKpiReport — one row per (kpi_id, report_date).
 */
export async function reportDailyKpiAction(input: {
  kpiId: string;
  value: string;
  status: string;
  comment?: string;
}): Promise<ReportDailyKpiResult> {
  const profile = await requireOperationalWriter();

  const kpiId = input.kpiId.trim();
  if (!kpiId) {
    return { ok: false, error: "Saknar KPI." };
  }

  const value = input.value.trim();
  if (!value) {
    return { ok: false, error: "Ange dagens värde." };
  }

  const kpi = await fetchKpiById(kpiId).catch(() => null);
  if (!kpi) {
    return { ok: false, error: "KPI hittades inte." };
  }

  // AO-chef may only report KPIs for their business_area_id.
  // VD/admin may report for any area (validated via requireOperationalWriter).
  if (profile.role === "ao_chef") {
    if (!profile.businessAreaId) {
      return { ok: false, error: "Inget affärsområde är kopplat till ditt konto." };
    }
    if (kpi.business_area_id !== profile.businessAreaId) {
      return {
        ok: false,
        error: "Du kan bara rapportera KPI:er för ditt eget affärsområde.",
      };
    }
  } else if (profile.role !== "vd" && profile.role !== "administrator") {
    return { ok: false, error: "Du saknar behörighet att rapportera KPI." };
  }

  // When direction is set and computable, use server-side status (ignore client).
  // Otherwise fall back to manual client status.
  const computedStatus = computeKpiStatus({
    direction: kpi.direction,
    toleranceType: kpi.tolerance_type,
    greenTolerance: kpi.green_tolerance,
    yellowTolerance: kpi.yellow_tolerance,
    value,
    target: kpi.target_value,
  });

  let status: StatusTone;
  if (computedStatus) {
    status = computedStatus;
  } else if (isStatus(input.status)) {
    status = input.status;
  } else {
    return { ok: false, error: "Ogiltig status." };
  }

  const comment = input.comment?.trim() ?? "";
  if ((status === "Gul" || status === "Röd") && !comment) {
    return {
      ok: false,
      error: "Beskriv kort varför KPI:n avviker.",
    };
  }

  const reportDate = toStockholmReportDate(new Date());

  try {
    await upsertDailyKpiReport({
      kpiId,
      reportDate,
      value,
      status,
      comment: comment || undefined,
      recordedBy: profile.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara rapporten.";
    return { ok: false, error: message };
  }

  revalidatePath("/report/kpis");
  revalidatePath("/");
  return { ok: true };
}
