import { createClient } from "@/lib/supabase/server";

const BUSINESS_AREA_COLUMNS =
  "id, name, slug, description, manager, status, vd_comment, created_at, updated_at";

export type BusinessAreaRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  manager: string | null;
  status: string;
  vd_comment: string | null;
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

export type UpdateBusinessAreaRowInput = {
  name: string;
  description: string | null;
  manager: string | null;
  status: string;
  vd_comment: string | null;
  updated_at: string;
};

export async function fetchBusinessAreas(): Promise<BusinessAreaRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_areas")
    .select(BUSINESS_AREA_COLUMNS)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Kunde inte hämta business_areas: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchBusinessAreaById(
  id: string,
): Promise<BusinessAreaRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_areas")
    .select(BUSINESS_AREA_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta business_area: ${error.message}`);
  }

  return data;
}

export async function fetchBusinessAreaBySlug(
  slug: string,
): Promise<BusinessAreaRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_areas")
    .select(BUSINESS_AREA_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta business_area: ${error.message}`);
  }

  return data;
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
    .select(BUSINESS_AREA_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara business_area: ${error.message}`);
  }

  return data;
}

export async function updateBusinessAreaRow(
  id: string,
  input: UpdateBusinessAreaRowInput,
): Promise<BusinessAreaRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("business_areas")
    .update({
      name: input.name,
      description: input.description,
      manager: input.manager,
      status: input.status,
      vd_comment: input.vd_comment,
      updated_at: input.updated_at,
    })
    .eq("id", id)
    .select(BUSINESS_AREA_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera business_area: ${error.message}`);
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
