import { activities, goals } from "@/data/mock";
import {
  businessAreaSlugExists,
  fetchBusinessAreas,
  insertBusinessArea,
} from "@/lib/supabase/business-areas";
import type { BusinessAreaSummary, StatusTone } from "@/types";

function toStatusTone(value: string): StatusTone {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return "Gul";
}

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = base || "verksamhet";
  let candidate = root;
  let suffix = 2;

  while (await businessAreaSlugExists(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function getBusinessAreas(): Promise<BusinessAreaSummary[]> {
  const rows = await fetchBusinessAreas();

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    manager: row.manager ?? "Ej angiven",
    status: toStatusTone(row.status),
    updatedAt: toDateKey(row.updated_at),
    goalCount: goals.filter((goal) => goal.areaSlug === row.slug).length,
    activityCount: activities.filter(
      (activity) => activity.areaSlug === row.slug,
    ).length,
  }));
}

export async function getBusinessAreaOptions(): Promise<
  { id: string; name: string }[]
> {
  const rows = await fetchBusinessAreas();
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export type CreateBusinessAreaData = {
  name: string;
  manager: string;
  description: string;
  status: StatusTone;
};

export async function createBusinessArea(
  data: CreateBusinessAreaData,
): Promise<void> {
  const name = data.name.trim();
  if (!name) {
    throw new Error("Namn är obligatoriskt.");
  }

  const slug = await uniqueSlug(slugifyName(name));

  await insertBusinessArea({
    name,
    slug,
    description: data.description.trim(),
    manager: data.manager.trim(),
    status: data.status,
  });
}
