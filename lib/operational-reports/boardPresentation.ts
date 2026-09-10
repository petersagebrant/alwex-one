import type { ActivityStatus } from "@/types/activity";
import type { OperationalReportPriority } from "@/types/operational-report";
import type { StatusTone } from "@/types/status";

export const STEERING_BOARD_STATUS_ACTIONS = [
  { value: "Ej påbörjad" as const, label: "Öppen" },
  { value: "Pågår" as const, label: "Pågår" },
  { value: "Klar" as const, label: "Klar" },
];

export const COMPACT_PRIORITY_LABELS: Record<OperationalReportPriority, string> =
  {
    urgent: "Akut",
    follow_up: "Följ upp",
    info: "Info",
  };

export function attentionKpiStatusMark(status: StatusTone): string {
  if (status === "Röd") {
    return "🔴";
  }
  if (status === "Gul") {
    return "🟡";
  }
  return "";
}

export function formatAttentionKpiTitle(kpi: {
  businessAreaName: string;
  name: string;
  status: StatusTone;
}): string {
  const mark = attentionKpiStatusMark(kpi.status);
  const line = `${kpi.businessAreaName} – ${kpi.name}`;
  return mark ? `${mark} ${line}` : line;
}

export function steeringBoardStatusLabel(status: ActivityStatus): string {
  if (status === "Pågår") {
    return "Pågår";
  }
  if (status === "Klar") {
    return "Klar";
  }
  return "Öppen";
}

export function isSteeringBoardStatusSelected(
  current: ActivityStatus,
  buttonValue: (typeof STEERING_BOARD_STATUS_ACTIONS)[number]["value"],
): boolean {
  if (buttonValue === "Ej påbörjad") {
    return current === "Ej påbörjad" || current === "Försenad";
  }
  return current === buttonValue;
}

export function isSteeringBoardActivityStatus(
  value: string,
): value is (typeof STEERING_BOARD_STATUS_ACTIONS)[number]["value"] {
  return STEERING_BOARD_STATUS_ACTIONS.some((item) => item.value === value);
}

export function followUpReportSourceLabel(input: {
  operationalReportId?: string | null;
  haulierName?: string | null;
}): string | null {
  if (!input.operationalReportId) {
    return null;
  }
  const haulier = input.haulierName?.trim();
  return haulier ? `Från rapport · ${haulier}` : "Från rapport";
}

export function nextSteeringBoardStatus(
  current: ActivityStatus,
): {
  value: (typeof STEERING_BOARD_STATUS_ACTIONS)[number]["value"];
  label: string;
} | null {
  if (current === "Klar") {
    return null;
  }
  if (current === "Pågår") {
    return { value: "Klar", label: "Klar" };
  }
  return { value: "Pågår", label: "Starta" };
}
