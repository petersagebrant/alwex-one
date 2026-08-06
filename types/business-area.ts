import type { StatusTone } from "./status";

export type BusinessArea = {
  slug: string;
  name: string;
  description: string;
  manager: string;
  status: StatusTone;
  updatedAt: string;
  vdComment?: string | null;
};

export type UpdateBusinessAreaInput = {
  id: string;
  name: string;
  description: string;
  manager: string;
  status: StatusTone;
  vdComment: string;
};
