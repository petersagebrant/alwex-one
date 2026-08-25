"use server";

import { revalidatePath } from "next/cache";
import {
  requireOperationalWriter,
  requireProfile,
} from "@/lib/auth/require-user";
import { computeKpiStatus } from "@/lib/kpi/computeStatus";
import { computeEconomicDeviation } from "@/lib/kpi/economics";
import { parseNumeric } from "@/lib/kpi/parseNumeric";
import {
  fetchBusinessAreaById,
  fetchBusinessAreaBySlug,
  fetchBusinessAreas,
} from "@/lib/supabase/business-areas";
import { fetchKpiById } from "@/lib/supabase/kpis";
import { fetchKpiHistoryByPeriodMonthsForKpis } from "@/lib/supabase/kpi-history";
import { getKpisForTodayReporting } from "@/services/kpiReporting";
import {
  dailyReportDateRejectedReason,
  resolveDailyReportDate,
} from "@/lib/kpi/dailyReportDate";
import {
  upsertDailyKpiReport,
  upsertMonthlyKpiReport,
  upsertMonthlyStatisticReport,
} from "@/services/kpiHistory";
import type { MyKpisForTodayReporting, StatusTone } from "@/types";

export type ReportDailyKpiResult =
  | { ok: true }
  | { ok: false; error: string };

export type ReportMonthlyKpiResult = ReportDailyKpiResult;
export type LoadMonthlyKpiResult =
  | {
      ok: true;
      value: string | null;
      actualValue: string | null;
      budgetValue: string | null;
      deviationValue: string | null;
      comment: string | null;
      isLegacyDeviation: boolean;
    }
  | { ok: false; error: string };

export type LoadVdAreaReportingResult =
  | { ok: true; reporting: MyKpisForTodayReporting }
  | { ok: false; error: string };

/**
 * VD/admin: resolve area (id or slug) and load reporting for the selected day.
 * Called from the client panel when the user changes selectedAreaId or date.
 */
export async function loadVdAreaReportingAction(
  areaParam: string,
  reportDate?: string,
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
    reportDate: resolveDailyReportDate(reportDate),
  });

  return { ok: true, reporting };
}

function isStatus(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

/**
 * Save or update a daily KPI report for `reportDate`.
 * AO-chef: own business_area_id only. VD/admin: any area (operational write).
 * Uses upsertDailyKpiReport — one row per (kpi_id, report_date).
 */
export async function reportDailyKpiAction(input: {
  kpiId: string;
  value: string;
  status: string;
  comment?: string;
  reportDate?: string;
}): Promise<ReportDailyKpiResult> {
  const profile = await requireOperationalWriter();

  const kpiId = input.kpiId.trim();
  if (!kpiId) {
    return { ok: false, error: "Saknar KPI." };
  }

  const value = input.value.trim();
  if (!value) {
    return { ok: false, error: "Ange ett värde." };
  }

  const reportDate =
    input.reportDate?.trim() || resolveDailyReportDate(undefined);
  const dateError = dailyReportDateRejectedReason(reportDate);
  if (dateError) {
    return { ok: false, error: dateError };
  }

  const kpi = await fetchKpiById(kpiId).catch(() => null);
  if (!kpi) {
    return { ok: false, error: "KPI hittades inte." };
  }

  if (kpi.archived_at) {
    return {
      ok: false,
      error: "Arkiverade KPI:er kan inte rapporteras. Återaktivera först.",
    };
  }

  if (kpi.kpi_kind === "CALCULATED" || kpi.calc_operator) {
    return {
      ok: false,
      error: "Beräknade KPI:er rapporteras inte manuellt.",
    };
  }

  if (kpi.reporting_frequency === "MONTHLY") {
    return {
      ok: false,
      error: "Månads-KPI:er rapporteras i månadsvyn, inte som daglig rapport.",
    };
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

  // Statistics KPIs never use Grön/Gul/Röd — store Statistik and skip comment gate.
  if (kpi.kpi_kind === "STATISTIC") {
    try {
      await upsertDailyKpiReport({
        kpiId,
        reportDate,
        value,
        status: "Statistik",
        comment: (input.comment?.trim() || undefined),
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

export async function reportMonthlyKpiAction(input: {
  kpiId: string;
  periodMonth: string;
  actualValue: string;
  budgetValue: string;
  comment?: string;
}): Promise<ReportMonthlyKpiResult> {
  const profile = await requireOperationalWriter();
  const kpi = await fetchKpiById(input.kpiId.trim()).catch(() => null);
  if (!kpi || kpi.archived_at) {
    return { ok: false, error: "KPI:n hittades inte eller är arkiverad." };
  }
  if (
    kpi.kpi_kind !== "TARGET" ||
    kpi.reporting_frequency !== "MONTHLY" ||
    kpi.calc_operator
  ) {
    return { ok: false, error: "KPI:n är inte ett manuellt månadsresultat." };
  }
  if (
    profile.role === "ao_chef" &&
    (!profile.businessAreaId || kpi.business_area_id !== profile.businessAreaId)
  ) {
    return { ok: false, error: "Du kan bara rapportera för ditt eget affärsområde." };
  }
  if (
    profile.role !== "ao_chef" &&
    profile.role !== "vd" &&
    profile.role !== "administrator"
  ) {
    return { ok: false, error: "Du saknar behörighet." };
  }
  if (!/^\d{4}-\d{2}-01$/.test(input.periodMonth)) {
    return { ok: false, error: "Välj en giltig resultatmånad." };
  }

  const deviation = computeEconomicDeviation(input.actualValue, input.budgetValue);
  if (deviation === null) {
    return { ok: false, error: "Ange giltigt faktiskt resultat och budgeterat resultat." };
  }
  const status = computeKpiStatus({
    direction: kpi.direction,
    toleranceType: kpi.tolerance_type,
    greenTolerance: kpi.green_tolerance,
    yellowTolerance: kpi.yellow_tolerance,
    value: deviation,
    target: kpi.target_value,
  });
  if (!status) return { ok: false, error: "Ange ett giltigt värde." };
  const comment = input.comment?.trim() ?? "";
  if ((status === "Gul" || status === "Röd") && !comment) {
    return { ok: false, error: "Beskriv kort varför resultatet avviker." };
  }

  try {
    await upsertMonthlyKpiReport({
      kpiId: kpi.id,
      periodMonth: input.periodMonth,
      actualValue: input.actualValue.trim(),
      budgetValue: input.budgetValue.trim(),
      status,
      comment: comment || undefined,
      recordedBy: profile.id,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Kunde inte spara månadsresultatet.",
    };
  }
  revalidatePath("/report/kpis");
  revalidatePath("/");
  return { ok: true };
}

export async function reportMonthlyStatisticKpiAction(input: {
  kpiId: string;
  periodMonth: string;
  value: string;
  comment?: string;
}): Promise<ReportMonthlyKpiResult> {
  const profile = await requireOperationalWriter();
  const kpi = await fetchKpiById(input.kpiId.trim()).catch(() => null);
  if (!kpi || kpi.archived_at) {
    return { ok: false, error: "KPI:n hittades inte eller är arkiverad." };
  }
  if (
    kpi.kpi_kind !== "STATISTIC" ||
    kpi.reporting_frequency !== "MONTHLY" ||
    kpi.calc_operator
  ) {
    return { ok: false, error: "KPI:n är inte en manuell månadsstatistik." };
  }
  if (
    profile.role === "ao_chef" &&
    (!profile.businessAreaId || kpi.business_area_id !== profile.businessAreaId)
  ) {
    return { ok: false, error: "Du kan bara rapportera för ditt eget affärsområde." };
  }
  if (
    profile.role !== "ao_chef" &&
    profile.role !== "vd" &&
    profile.role !== "administrator"
  ) {
    return { ok: false, error: "Du saknar behörighet." };
  }
  if (!/^\d{4}-\d{2}-01$/.test(input.periodMonth)) {
    return { ok: false, error: "Välj en giltig månad." };
  }
  const value = input.value.trim();
  if (parseNumeric(value) === null) {
    return { ok: false, error: "Ange ett giltigt värde." };
  }

  try {
    await upsertMonthlyStatisticReport({
      kpiId: kpi.id,
      periodMonth: input.periodMonth,
      value,
      comment: input.comment?.trim() || undefined,
      recordedBy: profile.id,
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Kunde inte spara månadsstatistiken.",
    };
  }
  revalidatePath("/report/kpis");
  revalidatePath("/");
  return { ok: true };
}

export async function loadMonthlyKpiValueAction(input: {
  kpiId: string;
  periodMonth: string;
}): Promise<LoadMonthlyKpiResult> {
  const profile = await requireProfile();
  const kpi = await fetchKpiById(input.kpiId.trim()).catch(() => null);
  if (!kpi || kpi.archived_at) {
    return { ok: false, error: "KPI:n hittades inte." };
  }
  const mayRead =
    profile.role === "vd" ||
    profile.role === "administrator" ||
    (profile.role === "ao_chef" &&
      profile.businessAreaId === kpi.business_area_id);
  if (!mayRead) return { ok: false, error: "Du saknar behörighet." };
  if (!/^\d{4}-\d{2}-01$/.test(input.periodMonth)) {
    return { ok: false, error: "Ogiltig resultatmånad." };
  }
  const rows = await fetchKpiHistoryByPeriodMonthsForKpis(
    [kpi.id],
    [input.periodMonth],
  ).catch(() => []);
  const row = rows[0];
  return row
    ? {
        ok: true,
        value: row.value,
        actualValue: row.actual_value,
        budgetValue: row.budget_value,
        deviationValue: row.value,
        comment: row.comment,
        isLegacyDeviation: row.actual_value == null && row.budget_value == null,
      }
    : {
        ok: true,
        value: null,
        actualValue: null,
        budgetValue: null,
        deviationValue: null,
        comment: null,
        isLegacyDeviation: false,
      };
}
