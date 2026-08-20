export type DailyReportActionLabel = "Rapportera" | "Ändra";

export function dailyReportActionLabel(
  isReported: boolean,
): DailyReportActionLabel {
  return isReported ? "Ändra" : "Rapportera";
}
