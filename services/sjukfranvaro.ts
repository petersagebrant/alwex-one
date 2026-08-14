import { computeWeightedRatioPercent } from "@/lib/kpi/calculated";
import { isStatusTone, parseKpiStoredStatus } from "@/lib/kpi/kind";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { fetchWeightedInputsForParents } from "@/lib/supabase/kpi-calc-weighted-inputs";
import {
  fetchKpiHistoryByReportDateForKpis,
} from "@/lib/supabase/kpi-history";
import { fetchAllKpis } from "@/lib/supabase/kpis";
import { getKPIs } from "@/services/kpis";
import { toStockholmReportDate } from "@/services/kpiHistory";
import type { StatusTone } from "@/types";

export type SjukfranvaroAreaRow = {
  areaId: string;
  areaName: string;
  kpiId: string;
  value: string | null;
  status: StatusTone | null;
  isReported: boolean;
};

export type SjukfranvaroComparison = {
  reportDate: string;
  company: {
    kpiId: string;
    value: string | null;
    status: StatusTone | null;
    targetValue: string | null;
    completenessLabel: string;
    isComplete: boolean;
    reportedAreas: number;
    totalAreas: number;
  } | null;
  areas: SjukfranvaroAreaRow[];
};

/**
 * VD comparison: Alwex totalt weighted % + per-AO Sjukfrånvaro with status colors.
 * Incomplete AOs show as not reported; company total excludes them from the SUM
 * (recomputed here for display consistency with completeness metadata).
 */
export async function getSjukfranvaroComparison(options?: {
  reportDate?: string;
}): Promise<SjukfranvaroComparison> {
  const reportDate = options?.reportDate ?? toStockholmReportDate(new Date());

  try {
    const [kpis, areas] = await Promise.all([
      getKPIs(),
      fetchBusinessAreas().catch(() => []),
    ]);

    const areaNameById = new Map(areas.map((area) => [area.id, area.name]));

    const companyKpi = kpis.find(
      (kpi) =>
        kpi.calcOperator === "WEIGHTED_RATIO_PERCENT" &&
        kpi.name === "Sjukfrånvaro Alwex totalt",
    );

    const aoPctKpis = kpis
      .filter(
        (kpi) =>
          kpi.calcOperator === "RATIO_PERCENT" && kpi.name === "Sjukfrånvaro",
      )
      .sort((a, b) =>
        (areaNameById.get(a.businessAreaId) ?? "").localeCompare(
          areaNameById.get(b.businessAreaId) ?? "",
          "sv",
        ),
      );

    const weightedRows = companyKpi
      ? await fetchWeightedInputsForParents([companyKpi.id]).catch(() => [])
      : [];

    const inputIds = new Set<string>();
    for (const row of weightedRows) {
      inputIds.add(row.numerator_kpi_id);
      inputIds.add(row.denominator_kpi_id);
    }
    for (const kpi of aoPctKpis) {
      if (kpi.calcNumeratorKpiId) inputIds.add(kpi.calcNumeratorKpiId);
      if (kpi.calcDenominatorKpiId) inputIds.add(kpi.calcDenominatorKpiId);
      inputIds.add(kpi.id);
    }
    if (companyKpi) inputIds.add(companyKpi.id);

    const historyRows =
      inputIds.size > 0
        ? await fetchKpiHistoryByReportDateForKpis(
            [...inputIds],
            reportDate,
          ).catch(() => [])
        : [];
    const todayByKpi = new Map(
      historyRows.map((row) => [row.kpi_id, row]),
    );

    const areasOut: SjukfranvaroAreaRow[] = aoPctKpis.map((kpi) => {
      const numOk = Boolean(
        kpi.calcNumeratorKpiId &&
          todayByKpi.get(kpi.calcNumeratorKpiId)?.value?.trim(),
      );
      const denOk = Boolean(
        kpi.calcDenominatorKpiId &&
          todayByKpi.get(kpi.calcDenominatorKpiId)?.value?.trim(),
      );
      const isReported = numOk && denOk;
      const today = todayByKpi.get(kpi.id);
      const statusRaw = parseKpiStoredStatus(today?.status ?? kpi.status);
      return {
        areaId: kpi.businessAreaId,
        areaName: areaNameById.get(kpi.businessAreaId) ?? kpi.businessAreaName,
        kpiId: kpi.id,
        value: isReported ? (today?.value ?? kpi.currentValue) : null,
        status: isReported && isStatusTone(statusRaw) ? statusRaw : null,
        isReported,
      };
    });

    let company: SjukfranvaroComparison["company"] = null;
    if (companyKpi) {
      const parts = weightedRows.map((row) => ({
        numeratorValue: todayByKpi.get(row.numerator_kpi_id)?.value ?? null,
        denominatorValue:
          todayByKpi.get(row.denominator_kpi_id)?.value ?? null,
      }));
      const weighted = computeWeightedRatioPercent(parts);
      const today = todayByKpi.get(companyKpi.id);
      const displayValue =
        weighted.value ??
        (weighted.reportedParts > 0
          ? (today?.value ?? companyKpi.currentValue)
          : null);
      const statusRaw = parseKpiStoredStatus(today?.status ?? companyKpi.status);
      company = {
        kpiId: companyKpi.id,
        value: weighted.reportedParts > 0 ? displayValue : null,
        status:
          weighted.reportedParts > 0 && isStatusTone(statusRaw)
            ? statusRaw
            : null,
        targetValue: companyKpi.targetValue,
        completenessLabel: weighted.completenessLabel,
        isComplete: weighted.isComplete,
        reportedAreas: weighted.reportedParts,
        totalAreas: weighted.totalParts,
      };
    }

    return { reportDate, company, areas: areasOut };
  } catch {
    // Table may not exist until migration is applied.
    return { reportDate, company: null, areas: [] };
  }
}

/** Lightweight existence check used to avoid empty dashboard sections. */
export async function hasSjukfranvaroKpis(): Promise<boolean> {
  try {
    const rows = await fetchAllKpis();
    return rows.some(
      (row) =>
        row.calc_operator === "RATIO_PERCENT" ||
        row.calc_operator === "WEIGHTED_RATIO_PERCENT",
    );
  } catch {
    return false;
  }
}
