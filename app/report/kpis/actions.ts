"use server";

import { revalidatePath } from "next/cache";
import { isVdEquivalent } from "@/lib/auth/roles";
import {
  requireOperationalWriter,
  requireProfile,
} from "@/lib/auth/require-user";
import { computeKpiStatus } from "@/lib/kpi/computeStatus";
import { computeEconomicDeviation } from "@/lib/kpi/economics";
import { parseNumeric } from "@/lib/kpi/parseNumeric";
import {
  authorizeDailyKpiReport,
  collectBatchDailyReports,
  dailyKpiValidationKpiFromKpi,
  dailyKpiValidationKpiFromRow,
  EMPTY_DAILY_BATCH_MESSAGE,
  formatBatchDailyReportError,
  prepareDailyKpiReport,
} from "@/lib/kpi/dailyKpiReport";
import {
  fetchBusinessAreaById,
  fetchBusinessAreaBySlug,
  fetchBusinessAreas,
} from "@/lib/supabase/business-areas";
import { fetchKpiById } from "@/lib/supabase/kpis";
import { fetchKpiHistoryByPeriodMonthsForKpis } from "@/lib/supabase/kpi-history";
import { getKPIsByBusinessArea } from "@/services/kpis";
import { getKpisForTodayReporting } from "@/services/kpiReporting";
import {
  dailyReportDateRejectedReason,
  resolveDailyReportDate,
} from "@/lib/kpi/dailyReportDate";
import {
  upsertDailyKpiReport,
  upsertDailyKpiReports,
  upsertMonthlyKpiReport,
  upsertMonthlyStatisticReport,
} from "@/services/kpiHistory";
import type { MyKpisForTodayReporting } from "@/types";

export type ReportDailyKpiResult =
  | { ok: true; message?: string }
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
  if (!isVdEquivalent(profile.role) && profile.role !== "administrator") {
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

async function resolveWriterBusinessAreaId(
  profile: { role: string; businessAreaId: string | null },
  requestedAreaId?: string,
): Promise<{ ok: true; businessAreaId: string } | { ok: false; error: string }> {
  if (profile.role === "ao_chef") {
    if (!profile.businessAreaId) {
      return { ok: false, error: "Inget affärsområde är kopplat till ditt konto." };
    }
    if (
      requestedAreaId?.trim() &&
      requestedAreaId.trim() !== profile.businessAreaId
    ) {
      return {
        ok: false,
        error: "Du kan bara rapportera KPI:er för ditt eget affärsområde.",
      };
    }
    return { ok: true, businessAreaId: profile.businessAreaId };
  }

  const raw = requestedAreaId?.trim() ?? "";
  if (!raw) {
    return { ok: false, error: "Inget affärsområde valt." };
  }
  return { ok: true, businessAreaId: raw };
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

  const kpiRow = await fetchKpiById(kpiId).catch(() => null);
  if (!kpiRow) {
    return { ok: false, error: "KPI hittades inte." };
  }

  const kpi = dailyKpiValidationKpiFromRow(kpiRow);
  const authorized = authorizeDailyKpiReport(profile, kpi);
  if (!authorized.ok) {
    return authorized;
  }

  const prepared = prepareDailyKpiReport(kpi, {
    value,
    status: input.status,
    comment: input.comment,
    reportDate,
  });
  if (!prepared.ok) {
    return prepared;
  }

  try {
    await upsertDailyKpiReport({
      kpiId: prepared.value.kpiId,
      reportDate: prepared.value.reportDate,
      value: prepared.value.value,
      status: prepared.value.status,
      comment: prepared.value.comment,
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

/**
 * Save all filled daily KPIs for one AO + date in one RPC transaction.
 * Empty fields are skipped. Invalid mix aborts the entire save.
 */
export async function reportDailyKpisBatchAction(input: {
  businessAreaId?: string;
  reportDate?: string;
  reports: Array<{
    kpiId: string;
    value: string;
    status: string;
    comment?: string;
  }>;
}): Promise<ReportDailyKpiResult> {
  const profile = await requireOperationalWriter();

  const reportDate =
    input.reportDate?.trim() || resolveDailyReportDate(undefined);
  const dateError = dailyReportDateRejectedReason(reportDate);
  if (dateError) {
    return { ok: false, error: dateError };
  }

  const area = await resolveWriterBusinessAreaId(profile, input.businessAreaId);
  if (!area.ok) {
    return area;
  }

  const areaKpis = await getKPIsByBusinessArea(area.businessAreaId).catch(
    () => [],
  );
  if (areaKpis.length === 0) {
    return { ok: false, error: "KPI hittades inte." };
  }

  for (const kpi of areaKpis) {
    const authorized = authorizeDailyKpiReport(profile, {
      businessAreaId: kpi.businessAreaId,
    });
    if (!authorized.ok) {
      return authorized;
    }
  }

  const collected = collectBatchDailyReports({
    reportDate,
    kpis: areaKpis.map(dailyKpiValidationKpiFromKpi),
    drafts: input.reports ?? [],
  });
  if (!collected.ok) {
    return {
      ok: false,
      error: formatBatchDailyReportError(collected.kpiNames),
    };
  }

  if (collected.reports.length === 0) {
    return { ok: true, message: EMPTY_DAILY_BATCH_MESSAGE };
  }

  try {
    await upsertDailyKpiReports(
      collected.reports.map((report) => ({
        kpiId: report.kpiId,
        reportDate: report.reportDate,
        value: report.value,
        status: report.status,
        comment: report.comment,
        recordedBy: profile.id,
      })),
    );
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
    !isVdEquivalent(profile.role) &&
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
    !isVdEquivalent(profile.role) &&
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
    isVdEquivalent(profile.role) ||
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
