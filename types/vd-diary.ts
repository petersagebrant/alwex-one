export type VdDiaryTone = "yellow" | "green" | "blue" | "red" | "slate";

export type VdDiaryEvent = {
  id: string;
  tone: VdDiaryTone;
  /** Change type, e.g. "KPI uppdaterad". */
  headline: string;
  /** Object name, e.g. KPI/goal/activity title. */
  title: string;
  /** Concrete from→to summary when structured audit data exists. */
  changeSummary: string | null;
  area: string;
  /** Actor who made the change, when known. */
  owner: string;
  occurredAt: string;
  occurredAtLabel: string;
  href: string | null;
};
