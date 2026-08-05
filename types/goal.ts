import type { StatusTone } from "./status";

export type Goal = {
  id: string;
  areaSlug: string;
  title: string;
  owner: string;
  deadline: string;
  status: StatusTone;
  progress: number;
};
