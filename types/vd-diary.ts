export type VdDiaryTone = "yellow" | "green" | "blue" | "red" | "slate";

export type VdDiaryEvent = {
  id: string;
  tone: VdDiaryTone;
  headline: string;
  title: string;
  area: string;
  owner: string;
  occurredAt: string;
  occurredAtLabel: string;
  href: string;
};
