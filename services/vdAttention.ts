import { parseNumeric } from "@/lib/kpi/parseNumeric";
import { isExcludedFromVdAttention } from "@/lib/kpi/vdAttentionFilter";
import type { StatusTone } from "@/types";
import type { KPIListItem } from "@/services/kpis";
import type { ActivityListItem } from "@/services/activities";
import type { DecisionListItem } from "@/services/decisions";

export type VdAttentionTone = "red" | "yellow" | "slate";

export type VdAttentionItemType =
  | "KPI"
  | "Aktivitet"
  | "Beslut"
  | "Affärsområde";

export type VdAttentionItem = {
  id: string;
  type: VdAttentionItemType;
  title: string;
  area: string;
  statusLabel: string;
  statusTone: VdAttentionTone;
  metrics: string | null;
  trend: string | null;
  owner: string | null;
  reason: string;
  href: string;
  linkLabel: string;
  priority: number;
};

type AreaLike = {
  id: string;
  name: string;
  slug: string;
  manager: string | null;
  status: string;
};

function cleanOwner(owner: string | null | undefined): string | null {
  const name = owner?.trim();
  if (!name || name === "Ej angiven") {
    return null;
  }
  return name;
}

function formatValue(value: string | null | undefined, unit?: string | null): string {
  const raw = value?.trim();
  if (!raw) return "—";
  return unit?.trim() ? `${raw} ${unit.trim()}` : raw;
}

function formatGapReason(
  current: number,
  target: number,
  unit: string | null | undefined,
): string | null {
  const gap = target - current;
  if (!Number.isFinite(gap) || gap <= 0) {
    return null;
  }
  const rounded = Math.round(gap * 10) / 10;
  const unitTrim = unit?.trim() ?? "";
  if (unitTrim === "%" || unitTrim.toLowerCase().includes("%")) {
    const label =
      Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString("sv-SE", {
        maximumFractionDigits: 1,
      });
    return `${label} procentenheter under mål`;
  }
  const label = rounded.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
  return `${label}${unitTrim ? ` ${unitTrim}` : ""} under målvärde`;
}

function statusToneFrom(status: string): VdAttentionTone {
  if (status === "Röd" || status === "Försenad") return "red";
  if (status === "Gul") return "yellow";
  return "slate";
}

function kpiMetrics(kpi: KPIListItem): string | null {
  if (!kpi.currentValue && !kpi.targetValue) {
    return null;
  }
  if (kpi.currentValue && kpi.targetValue) {
    return `${formatValue(kpi.currentValue, kpi.unit)} mot mål ${formatValue(kpi.targetValue, kpi.unit)}`;
  }
  if (kpi.currentValue) {
    return `Utfall ${formatValue(kpi.currentValue, kpi.unit)}`;
  }
  return `Mål ${formatValue(kpi.targetValue, kpi.unit)}`;
}

function kpiReason(kpi: KPIListItem): string {
  const parts: string[] = [];
  const current = parseNumeric(kpi.currentValue);
  const target = parseNumeric(kpi.targetValue);
  if (current !== null && target !== null) {
    const gap = formatGapReason(current, target, kpi.unit);
    if (gap) {
      parts.push(gap);
    }
  }
  if (kpi.status === "Röd") {
    parts.push("röd status");
  } else if (kpi.status === "Gul") {
    parts.push("gul status");
  }
  if (kpi.trend === "Ner") {
    parts.push("negativ utveckling");
  }
  if (parts.length === 0) {
    return "Kräver uppföljning enligt aktuell status.";
  }
  const text = parts.join(" och ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

function isSignificantDeviation(kpi: KPIListItem): boolean {
  const current = parseNumeric(kpi.currentValue);
  const target = parseNumeric(kpi.targetValue);
  if (current === null || target === null || target === 0) {
    return false;
  }
  const gapPct = Math.abs((target - current) / Math.abs(target)) * 100;
  const gapAbs = target - current;
  // "Kraftig" negativ avvikelse: under mål med ≥8% relativ gap eller ≥5 %-enheter for % units.
  if (gapAbs <= 0) {
    return false;
  }
  const unit = kpi.unit?.trim() ?? "";
  if (unit === "%" || unit.toLowerCase().includes("%")) {
    return gapAbs >= 5 || gapPct >= 8;
  }
  return gapPct >= 8 || gapAbs >= Math.abs(target) * 0.08;
}

/**
 * Deterministic VD attention queue (no OpenAI). Max 5 actionable items.
 */
export function buildVdAttentionItems(input: {
  kpis: KPIListItem[];
  delayedActivities: ActivityListItem[];
  openDecisions: DecisionListItem[];
  areas: AreaLike[];
  areaManagers: Map<string, string>;
  limit?: number;
}): VdAttentionItem[] {
  const limit = input.limit ?? 5;
  const items: VdAttentionItem[] = [];
  const seen = new Set<string>();

  function push(item: VdAttentionItem) {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  }

  // 1) Red KPIs
  for (const kpi of input.kpis) {
    if (kpi.kind !== "TARGET") continue;
    if (isExcludedFromVdAttention(kpi)) continue;
    if (kpi.status !== "Röd") continue;
    push({
      id: `kpi-red-${kpi.id}`,
      type: "KPI",
      title: kpi.name,
      area: kpi.businessAreaName,
      statusLabel: kpi.status,
      statusTone: "red",
      metrics: kpiMetrics(kpi),
      trend: kpi.trend,
      owner: cleanOwner(input.areaManagers.get(kpi.businessAreaId)),
      reason: kpiReason(kpi),
      href: `/admin/kpis/${kpi.id}`,
      linkLabel: "Öppna KPI",
      priority: 100,
    });
  }

  // 2) Significant negative KPI deviations (not already covered as red-only)
  for (const kpi of input.kpis) {
    if (kpi.kind !== "TARGET") continue;
    if (isExcludedFromVdAttention(kpi)) continue;
    if (kpi.status === "Grön") continue;
    if (!isSignificantDeviation(kpi)) continue;
    const alreadyRed = seen.has(`kpi-red-${kpi.id}`);
    if (alreadyRed) {
      // Boost reason already present; skip duplicate card.
      continue;
    }
    push({
      id: `kpi-gap-${kpi.id}`,
      type: "KPI",
      title: kpi.name,
      area: kpi.businessAreaName,
      statusLabel: kpi.status,
      statusTone: statusToneFrom(kpi.status),
      metrics: kpiMetrics(kpi),
      trend: kpi.trend,
      owner: cleanOwner(input.areaManagers.get(kpi.businessAreaId)),
      reason: kpiReason(kpi),
      href: `/admin/kpis/${kpi.id}`,
      linkLabel: "Öppna KPI",
      priority: kpi.status === "Röd" ? 95 : 90,
    });
  }

  // 3) Delayed activities
  for (const activity of input.delayedActivities) {
    const deadline = activity.deadline
      ? activity.deadline.slice(0, 10)
      : null;
    push({
      id: `activity-delayed-${activity.id}`,
      type: "Aktivitet",
      title: activity.title,
      area: activity.businessAreaName,
      statusLabel: "Försenad",
      statusTone: "red",
      metrics: deadline ? `Deadline ${deadline}` : null,
      trend: null,
      owner: cleanOwner(activity.owner),
      reason: deadline
        ? `Aktiviteten är försenad (deadline ${deadline}).`
        : "Aktiviteten är försenad.",
      href: `/activities/${activity.id}`,
      linkLabel: "Öppna aktivitet",
      priority: 80,
    });
  }

  // 4) Open decisions awaiting action
  for (const decision of input.openDecisions) {
    if (decision.status === "Klart") continue;
    const due = decision.dueDate ? decision.dueDate.slice(0, 10) : null;
    push({
      id: `decision-open-${decision.id}`,
      type: "Beslut",
      title: decision.title,
      area: decision.businessAreaName,
      statusLabel: decision.status,
      statusTone: "yellow",
      metrics: due ? `Förfaller ${due}` : null,
      trend: null,
      owner: cleanOwner(decision.owner),
      reason: due
        ? `Öppet beslut som väntar på åtgärd (förfaller ${due}).`
        : "Öppet beslut som väntar på åtgärd eller uppföljning.",
      href: `/admin/decisions/${decision.id}`,
      linkLabel: "Öppna beslut",
      priority: 70,
    });
  }

  // 5) Yellow KPIs with clear negative trend
  for (const kpi of input.kpis) {
    if (kpi.kind !== "TARGET") continue;
    if (isExcludedFromVdAttention(kpi)) continue;
    if (kpi.status !== "Gul" || kpi.trend !== "Ner") continue;
    if (seen.has(`kpi-red-${kpi.id}`) || seen.has(`kpi-gap-${kpi.id}`)) {
      continue;
    }
    push({
      id: `kpi-yellow-trend-${kpi.id}`,
      type: "KPI",
      title: kpi.name,
      area: kpi.businessAreaName,
      statusLabel: kpi.status,
      statusTone: "yellow",
      metrics: kpiMetrics(kpi),
      trend: kpi.trend,
      owner: cleanOwner(input.areaManagers.get(kpi.businessAreaId)),
      reason: kpiReason(kpi),
      href: `/admin/kpis/${kpi.id}`,
      linkLabel: "Öppna KPI",
      priority: 60,
    });
  }

  // 6) Red business areas
  for (const area of input.areas) {
    if (area.status !== "Röd") continue;
    push({
      id: `area-red-${area.id}`,
      type: "Affärsområde",
      title: area.name,
      area: area.name,
      statusLabel: "Röd",
      statusTone: "red",
      metrics: null,
      trend: null,
      owner: cleanOwner(area.manager),
      reason: "Affärsområdet har röd status och kräver ledningens uppföljning.",
      href: `/areas/${area.slug}`,
      linkLabel: "Öppna affärsområde",
      priority: 50,
    });
  }

  return items
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.title.localeCompare(b.title, "sv");
    })
    .slice(0, limit);
}
