import { isExcludedFromVdAttention } from "@/lib/kpi/vdAttentionFilter";
import {
  reportedTargetStatusTone,
  type AreaOperationalStatusKpi,
} from "@/lib/kpi/areaOperationalStatus";
import type { KpiCalcOperator, KpiKind } from "@/lib/kpi/kind";
import type { StatusTone } from "@/types/status";

export type DashboardTargetKpi = AreaOperationalStatusKpi & {
  kind: KpiKind;
  calcOperator?: KpiCalcOperator | null;
};

export function classifyDashboardTargetKpis<T extends DashboardTargetKpi>(
  kpis: T[],
): {
  greenKpis: T[];
  yellowKpis: T[];
  redKpis: T[];
  followUpKpis: T[];
} {
  const greenKpis: T[] = [];
  const yellowKpis: T[] = [];
  const redKpis: T[] = [];
  const followUpKpis: T[] = [];

  for (const kpi of kpis) {
    const tone = reportedTargetStatusTone(kpi);
    if (tone == null) {
      continue;
    }
    if (tone === "Grön") {
      greenKpis.push(kpi);
      continue;
    }
    if (isExcludedFromVdAttention(kpi)) {
      continue;
    }
    if (tone === "Gul") {
      yellowKpis.push(kpi);
      followUpKpis.push(kpi);
    } else if (tone === "Röd") {
      redKpis.push(kpi);
      followUpKpis.push(kpi);
    }
  }

  return { greenKpis, yellowKpis, redKpis, followUpKpis };
}

export function isFollowUpTargetTone(tone: StatusTone | null): boolean {
  return tone === "Gul" || tone === "Röd";
}
