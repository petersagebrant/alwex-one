import {
  computeAreaOperationalStatus,
  formatAreaOperationalStatus,
  groupKpisByBusinessAreaId,
  type AreaOperationalStatus,
  type AreaOperationalStatusKpi,
} from "@/lib/kpi/areaOperationalStatus";
import {
  selectKeyKpis,
  type KeyKpiCandidate,
} from "@/lib/kpi/selectKeyKpis";
import { isAlwexTotaltSlug } from "@/lib/notices/visibility";

const STATUS_SORT: Record<"Röd" | "Gul" | "Grön" | "unreported", number> = {
  Röd: 0,
  Gul: 1,
  unreported: 2,
  Grön: 3,
};

export type VdAreaOverviewSourceArea = {
  id: string;
  name: string;
  slug: string;
  manager: string;
  /** When set (dashboard TARGET lights), reused instead of recomputing. */
  status?: AreaOperationalStatus;
};

export type VdAreaOverviewKpi = KeyKpiCandidate &
  AreaOperationalStatusKpi & {
    businessAreaId: string;
  };

export type VdAreaOverviewRow = {
  id: string;
  name: string;
  slug: string;
  href: string;
  manager: string;
  status: AreaOperationalStatus;
  statusLabel: ReturnType<typeof formatAreaOperationalStatus>;
  keyDeviation: string;
};

/**
 * Compact VD dashboard rows: one operational AO, existing TARGET lights,
 * and the reddest key exception from selectKeyKpis.
 */
export function buildVdAreaOverviewRows(
  areas: VdAreaOverviewSourceArea[],
  kpis: VdAreaOverviewKpi[],
): VdAreaOverviewRow[] {
  const kpisByArea = groupKpisByBusinessAreaId(kpis);

  const rows = (areas ?? [])
    .filter((area) => !isAlwexTotaltSlug(area.slug))
    .map((area) => {
      const areaKpis = kpisByArea.get(area.id) ?? [];
      const status =
        area.status !== undefined
          ? area.status
          : computeAreaOperationalStatus(areaKpis);
      return {
        id: area.id,
        name: area.name,
        slug: area.slug,
        href: `/areas/${area.slug}`,
        manager: area.manager?.trim() ? area.manager : "—",
        status,
        statusLabel: formatAreaOperationalStatus(status),
        keyDeviation: keyDeviationLabel(areaKpis, status),
      };
    });

  return rows.sort((a, b) => {
    const rankDiff = statusSortRank(a.status) - statusSortRank(b.status);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return a.name.localeCompare(b.name, "sv");
  });
}

function statusSortRank(status: AreaOperationalStatus): number {
  if (status == null) {
    return STATUS_SORT.unreported;
  }
  return STATUS_SORT[status];
}

function keyDeviationLabel(
  kpis: VdAreaOverviewKpi[],
  status: AreaOperationalStatus,
): string {
  if (status !== "Röd" && status !== "Gul") {
    return status === "Grön"
      ? "Inga väsentliga avvikelser"
      : "Ingen rapporterad avvikelse";
  }

  const key = selectKeyKpis(kpis, 1)[0];
  const name = key?.name?.trim();
  return name || "Avvikelse utan namn";
}
