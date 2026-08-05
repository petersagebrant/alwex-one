import type { StatusTone } from "./status";

export type Activity = {
  id: string;
  areaSlug: string;
  title: string;
  owner: string;
  dueDate: string;
  status: "Öppen" | "Pågår" | "Klar";
  priority: StatusTone;
};
