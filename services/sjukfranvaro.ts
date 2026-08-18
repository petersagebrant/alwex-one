import {
  computeRatioPercentValue,
  computeWeightedRatioPercent,
} from "@/lib/kpi/calculated";
import {
  hasValidKpiCurrentValue,
  isStatusTone,
  parseKpiStoredStatus,
} from "@/lib/kpi/kind";
import {
  hasValidRatioInputs,
  orderRatioKpisByWeightedInputs,
  resolvePeriodKpiValue,
} from "@/lib/kpi/sjukfranvaroAreas";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import { fetchWeightedInputsForParents } from "@/lib/supabase/kpi-calc-weighted-inputs";
import { fetchKpiHistoryByReportDateForKpis } from "@/lib/supabase/kpi-history";
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
 *
 * Input values prefer kpi_history for reportDate, else kpis.current_value —
 * the same source-of-truth as the stored weighted total.
 *
 * AO list follows weighted-input sort_order (normal AO order), not value.
 */
export async function getSjukfranvaroComparison(options?: {
  reportDate?: string;
  /** Prefer this WEIGHTED_RATIO_PERCENT KPI when several exist. */
  companyKpiId?: string;
}): Promise<SjukfranvaroComparison> {
  const reportDate = options?.reportDate ?? toStockholmReportDate(new Date());

  try {
    const [kpis, areas] = await Promise.all([
      getKPIs(),
      fetchBusinessAreas().catch(() => []),
    ]);

    const areaNameById = new Map(areas.map((area) => [area.id, area.name]));
    const currentByKpiId = new Map(
      kpis.map((kpi) => [kpi.id, kpi.currentValue] as const),
    );

    const weightedCandidates = kpis.filter(
      (kpi) => kpi.calcOperator === "WEIGHTED_RATIO_PERCENT",
    );
    const companyKpi =
      (options?.companyKpiId
        ? weightedCandidates.find((kpi) => kpi.id === options.companyKpiId)
        : null) ??
      weightedCandidates.find(
        (kpi) => kpi.name === "Sjukfrånvaro Alwex totalt",
      ) ??
      weightedCandidates[0] ??
      null;

    const aoPctKpis = kpis.filter(
      (kpi) =>
        kpi.calcOperator === "RATIO_PERCENT" ||
        kpi.calcOperator === "MONTH_TO_DATE_RATIO_PERCENT",
    );

    const weightedRows = companyKpi
      ? await fetchWeightedInputsForParents([companyKpi.id]).catch(() => [])
      : [];

    const weightedPairs = weightedRows.map((row) => ({
      numeratorKpiId: row.numerator_kpi_id,
      denominatorKpiId: row.denominator_kpi_id,
      sortOrder: row.sort_order,
    }));

    // Prefer weighted-input order (seeded AO order). Fallback: name match + AO name.
    const displayAoPctKpis =
      weightedPairs.length > 0
        ? orderRatioKpisByWeightedInputs(aoPctKpis, weightedPairs)
        : [...aoPctKpis]
            .filter((kpi) => kpi.name === "Sjukfrånvaro")
            .sort((a, b) =>
              (
                areaNameById.get(a.businessAreaId) ?? a.businessAreaName
              ).localeCompare(
                areaNameById.get(b.businessAreaId) ?? b.businessAreaName,
                "sv",
              ),
            );

    const inputIds = new Set<string>();
    for (const row of weightedRows) {
      inputIds.add(row.numerator_kpi_id);
      inputIds.add(row.denominator_kpi_id);
    }
    for (const kpi of displayAoPctKpis) {
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

    const periodValue = (kpiId: string | null | undefined): string | null => {
      if (!kpiId) return null;
      return resolvePeriodKpiValue(
        todayByKpi.get(kpiId)?.value,
        currentByKpiId.get(kpiId) ?? null,
      );
    };

    const areasOut: SjukfranvaroAreaRow[] = displayAoPctKpis.map((kpi) => {
      const today = todayByKpi.get(kpi.id);
      const statusRaw = parseKpiStoredStatus(today?.status ?? kpi.status);
      if (kpi.calcOperator === "MONTH_TO_DATE_RATIO_PERCENT") {
        const value = today?.value ?? null;
        const isReported = hasValidKpiCurrentValue(value);
        return {
          areaId: kpi.businessAreaId,
          areaName:
            areaNameById.get(kpi.businessAreaId) ?? kpi.businessAreaName,
          kpiId: kpi.id,
          value: isReported ? value : null,
          status: isReported && isStatusTone(statusRaw) ? statusRaw : null,
          isReported,
        };
      }

      const numeratorValue = periodValue(kpi.calcNumeratorKpiId);
      const denominatorValue = periodValue(kpi.calcDenominatorKpiId);
      const isReported = hasValidRatioInputs(
        numeratorValue,
        denominatorValue,
      );
      const computedValue = isReported
        ? computeRatioPercentValue(numeratorValue, denominatorValue)
        : null;
      return {
        areaId: kpi.businessAreaId,
        areaName: areaNameById.get(kpi.businessAreaId) ?? kpi.businessAreaName,
        kpiId: kpi.id,
        value: isReported
          ? (computedValue ?? today?.value ?? kpi.currentValue)
          : null,
        status: isReported && isStatusTone(statusRaw) ? statusRaw : null,
        isReported,
      };
    });

    let company: SjukfranvaroComparison["company"] = null;
    if (companyKpi) {
      const parts = weightedRows.map((row) => ({
        numeratorValue: periodValue(row.numerator_kpi_id),
        denominatorValue: periodValue(row.denominator_kpi_id),
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
        row.calc_operator === "MONTH_TO_DATE_RATIO_PERCENT" ||
        row.calc_operator === "WEIGHTED_RATIO_PERCENT",
    );
  } catch {
    return false;
  }
}
