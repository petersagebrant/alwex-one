import { createClient } from "@/lib/supabase/server";
import type { AreaNoticeKind } from "@/types/area-notice";

export type AreaNoticeRow = {
  id: string;
  business_area_id: string;
  kind: AreaNoticeKind;
  title: string;
  body: string;
  created_by: string | null;
  updated_by: string | null;
  created_by_name: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
  ends_on: string | null;
  archived_at: string | null;
};

export type AreaNoticeAreaLabel = {
  id: string;
  name: string;
  slug: string;
};

export type InsertAreaNoticeInput = {
  business_area_id: string;
  kind: AreaNoticeKind;
  title: string;
  body: string;
  created_by: string | null;
  updated_by: string | null;
  created_by_name: string;
  updated_by_name: string;
  ends_on: string | null;
};

export type UpdateAreaNoticeRowInput = {
  business_area_id: string;
  kind: AreaNoticeKind;
  title: string;
  body: string;
  updated_by: string | null;
  updated_by_name: string;
  ends_on: string | null;
};

const noticeSelect =
  "id, business_area_id, kind, title, body, created_by, updated_by, created_by_name, updated_by_name, created_at, updated_at, ends_on, archived_at";

export async function fetchAreaNoticesByBusinessAreaId(
  businessAreaId: string,
  options?: { includeArchived?: boolean },
): Promise<AreaNoticeRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("area_notices")
    .select(noticeSelect)
    .eq("business_area_id", businessAreaId)
    .order("created_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Kunde inte hämta Aktuellt: ${error.message}`);
  }

  return (data ?? []) as AreaNoticeRow[];
}

export async function fetchAllAreaNotices(options?: {
  includeArchived?: boolean;
}): Promise<AreaNoticeRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("area_notices")
    .select(noticeSelect)
    .order("created_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Kunde inte hämta Aktuellt: ${error.message}`);
  }

  return (data ?? []) as AreaNoticeRow[];
}

export async function fetchAreaNoticeById(
  id: string,
): Promise<AreaNoticeRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("area_notices")
    .select(noticeSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Kunde inte hämta Aktuellt: ${error.message}`);
  }

  return (data as AreaNoticeRow | null) ?? null;
}

export async function fetchAreaNoticeAreaLabels(): Promise<
  AreaNoticeAreaLabel[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("area_notice_area_labels");

  if (error) {
    throw new Error(
      `Kunde inte hämta affärsområden för Aktuellt: ${error.message}`,
    );
  }

  return (data ?? []) as AreaNoticeAreaLabel[];
}

export async function insertAreaNotice(
  input: InsertAreaNoticeInput,
): Promise<AreaNoticeRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("area_notices")
    .insert(input)
    .select(noticeSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte spara Aktuellt: ${error.message}`);
  }

  return data as AreaNoticeRow;
}

export async function updateAreaNoticeRow(
  id: string,
  input: UpdateAreaNoticeRowInput,
): Promise<AreaNoticeRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("area_notices")
    .update(input)
    .eq("id", id)
    .select(noticeSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera Aktuellt: ${error.message}`);
  }

  return data as AreaNoticeRow;
}

export async function updateAreaNoticeArchivedAt(
  id: string,
  archivedAt: string | null,
  actor: { id: string | null; name: string },
): Promise<AreaNoticeRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("area_notices")
    .update({
      archived_at: archivedAt,
      updated_by: actor.id,
      updated_by_name: actor.name,
    })
    .eq("id", id)
    .select(noticeSelect)
    .single();

  if (error) {
    throw new Error(`Kunde inte uppdatera arkivering av Aktuellt: ${error.message}`);
  }

  return data as AreaNoticeRow;
}
