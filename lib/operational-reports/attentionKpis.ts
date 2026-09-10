import { reportedTargetStatusTone } from "@/lib/kpi/areaOperationalStatus";
import {
  classifyDashboardTargetKpis,
  type DashboardTargetKpi,
} from "@/lib/kpi/reportedTargetKpis";
import { formatAttentionKpiTitle } from "@/lib/operational-reports/boardPresentation";
import type { StatusTone } from "@/types/status";

export type DailySteeringAttentionKpi = {
  id: string;
  name: string;
  businessAreaId: string;
  businessAreaName: string;
  status: StatusTone;
  titleLabel: string;
  valueLabel: string;
  href: string;
};

type AttentionKpiSource = DashboardTargetKpi & {
  id: string;
  name: string;
  businessAreaId?: string;
  businessAreaName?: string | null;
  currentValue?: string | null;
  targetValue?: string | null;
  unit?: string | null;
};

function formatKpiValuePart(
  value: string | null | undefined,
  unit?: string | null,
): string {
  const raw = value?.trim();
  if (!raw) {
    return "—";
  }
  return unit?.trim() ? `${raw} ${unit.trim()}` : raw;
}

export function formatAttentionKpiValue(kpi: {
  currentValue?: string | null;
  targetValue?: string | null;
  unit?: string | null;
}): string {
  const unit = kpi.unit;
  if (!kpi.currentValue && !kpi.targetValue) {
    return "—";
  }
  if (kpi.currentValue && kpi.targetValue) {
    return `${formatKpiValuePart(kpi.currentValue, unit)} mot mål ${formatKpiValuePart(kpi.targetValue, unit)}`;
  }
  if (kpi.currentValue) {
    return formatKpiValuePart(kpi.currentValue, unit);
  }
  return `mål ${formatKpiValuePart(kpi.targetValue, unit)}`;
}

/** Red then yellow TARGET KPIs from existing classifyDashboardTargetKpis. */
export function dailySteeringAttentionKpis<T extends AttentionKpiSource>(
  kpis: T[],
): DailySteeringAttentionKpi[] {
  const { redKpis, yellowKpis } = classifyDashboardTargetKpis(kpis);
  return [...redKpis, ...yellowKpis].flatMap((kpi) => {
    const status = reportedTargetStatusTone(kpi);
    if (status !== "Röd" && status !== "Gul") {
      return [];
    }
    return [
      {
        id: kpi.id,
        name: kpi.name,
        businessAreaId: kpi.businessAreaId ?? "",
        businessAreaName: kpi.businessAreaName?.trim() || "Okänt område",
        status,
        titleLabel: formatAttentionKpiTitle({
          businessAreaName: kpi.businessAreaName?.trim() || "Okänt område",
          name: kpi.name,
          status,
        }),
        valueLabel: formatAttentionKpiValue(kpi),
        href: `/kpis/${kpi.id}`,
      },
    ];
  });
}
