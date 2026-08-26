import {
  effectiveTargetStatusTone,
  type KpiKind,
  type KpiStoredStatus,
} from "@/lib/kpi/kind";
import { isMonthlyRevenueVsBudgetKpi } from "@/lib/kpi/economics";
import type { StatusTone } from "@/types/status";

export type AreaOperationalStatus = StatusTone | null;

export const AREA_STATUS_UNREPORTED = "Ej rapporterat" as const;

export type AreaOperationalStatusKpi = {
  kind: KpiKind;
  status: KpiStoredStatus | string;
  currentValue?: string | null;
  isPeriodPending?: boolean;
  name?: string | null;
};

/**
 * Effective G/Y/R for a TARGET that is reported for the current period.
 * Missing value or pending monthly period → not counted.
 */
export function reportedTargetStatusTone(kpi: AreaOperationalStatusKpi): StatusTone | null {
  if (kpi.isPeriodPending) {
    return null;
  }
  return effectiveTargetStatusTone({
    kind: kpi.kind,
    status: kpi.status as KpiStoredStatus,
    currentValue: kpi.currentValue,
  });
}

/**
 * Display status for a business area from relevant reported TARGET KPIs.
 * STATISTIC/CALCULATED and unreported/pending TARGET are ignored.
 * RATIO TARGET with a valid value are included (worst-of: Röd > Gul > Grön).
 * Omsättning mot budget is excluded so Resultat mot budget remains the
 * economic light (avoids two TARGET economy KPIs double-counting).
 * null = Ej rapporterat — must not count as Grön/Gul/Röd.
 */
export function computeAreaOperationalStatus(
  kpis: AreaOperationalStatusKpi[],
): AreaOperationalStatus {
  let worst: StatusTone | null = null;
  for (const kpi of kpis) {
    if (isMonthlyRevenueVsBudgetKpi(kpi)) {
      continue;
    }
    const tone = reportedTargetStatusTone(kpi);
    if (tone == null) {
      continue;
    }
    if (tone === "Röd") {
      return "Röd";
    }
    if (tone === "Gul") {
      worst = "Gul";
      continue;
    }
    if (worst == null) {
      worst = "Grön";
    }
  }
  return worst;
}

export function formatAreaOperationalStatus(
  status: AreaOperationalStatus,
): StatusTone | typeof AREA_STATUS_UNREPORTED {
  return status ?? AREA_STATUS_UNREPORTED;
}

export function groupKpisByBusinessAreaId<T extends { businessAreaId: string }>(
  kpis: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const kpi of kpis) {
    const list = map.get(kpi.businessAreaId);
    if (list) {
      list.push(kpi);
    } else {
      map.set(kpi.businessAreaId, [kpi]);
    }
  }
  return map;
}
