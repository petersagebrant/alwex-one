import { createClient } from "@/lib/supabase/server";

export type BusinessAreaRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  manager: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CreateBusinessAreaInput = {
  name: string;
  slug: string;
  description: string;
  manager: string;
  status: string;
};

export async function fetchBusinessAreas(): Promise<BusinessAreaRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_areas")
    .select(
      "id, name, slug, description, manager, status, created_at, updated_at",
    )
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta business_areas: ${error.message}`);
  }

  return data ?? [];
}

export async function insertBusinessArea(
  input: CreateBusinessAreaInput,
): Promise<BusinessAreaRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_areas")
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      manager: input.manager || null,
      status: input.status,
    })
    .select(
      "id, name, slug, description, manager, status, created_at, updated_at",
    )
    .single();

  if (error) {
    throw new Error(`Kunde inte spara business_area: ${error.message}`);
  }

  return data;
}

export async function businessAreaSlugExists(slug: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_areas")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte kontrollera slug: ${error.message}`);
  }

  return Boolean(data);
}

export async function fetchBusinessAreaBySlug(
  slug: string,
): Promise<BusinessAreaRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_areas")
    .select(
      "id, name, slug, description, manager, status, created_at, updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta business_area: ${error.message}`);
  }

  return data;
}
