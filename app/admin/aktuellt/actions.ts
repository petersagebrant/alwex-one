"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperationalWriter } from "@/lib/auth/require-user";
import { canWriteAreaNoticesForArea } from "@/lib/notices/permissions";
import { parseAreaNoticeFormValues } from "@/lib/notices/validateNoticeForm";
import {
  archiveAreaNotice,
  createAreaNotice,
  unarchiveAreaNotice,
  updateAreaNotice,
} from "@/services/areaNotices";

function firstParam(value: FormDataEntryValue | null): string {
  return String(value ?? "");
}

function noticesNewPath(
  areaId: string | null,
  returnTo: string | null,
  error?: string,
): string {
  if (returnTo?.startsWith("/areas/")) {
    const params = new URLSearchParams();
    params.set("notice", "new");
    if (error) {
      params.set("error", error);
    }
    return `${returnTo}?${params.toString()}`;
  }

  const params = new URLSearchParams();
  params.set("new", "1");
  if (areaId) {
    params.set("area", areaId);
  }
  if (error) {
    params.set("error", error);
  }
  return `/admin/aktuellt?${params.toString()}`;
}

function noticesEditPath(
  id: string,
  returnTo: string | null,
  error?: string,
): string {
  if (returnTo?.startsWith("/areas/")) {
    const params = new URLSearchParams();
    params.set("notice", id);
    if (error) {
      params.set("error", error);
    }
    return `${returnTo}?${params.toString()}`;
  }

  const params = new URLSearchParams();
  params.set("edit", id);
  if (error) {
    params.set("error", error);
  }
  return `/admin/aktuellt?${params.toString()}`;
}

function readNoticeFields(formData: FormData) {
  return {
    businessAreaId: firstParam(formData.get("businessAreaId")),
    kind: firstParam(formData.get("kind")),
    title: firstParam(formData.get("title")),
    body: firstParam(formData.get("body")),
    endsOn: firstParam(formData.get("endsOn")),
  };
}

function safeReturnTo(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }
  if (trimmed.startsWith("/areas/") || trimmed === "/admin/aktuellt") {
    return trimmed.split("?")[0] ?? trimmed;
  }
  return null;
}

function revalidateNoticePaths(areaSlug?: string | null) {
  revalidatePath("/");
  revalidatePath("/areas");
  revalidatePath("/admin/aktuellt");
  if (areaSlug) {
    revalidatePath(`/areas/${areaSlug}`);
  }
}

export async function createAreaNoticeAction(formData: FormData) {
  const profile = await requireOperationalWriter();
  const fields = readNoticeFields(formData);
  const areaId = fields.businessAreaId.trim() || null;
  const returnTo = safeReturnTo(firstParam(formData.get("returnTo")));
  const parsed = parseAreaNoticeFormValues(fields);

  if (!parsed.ok) {
    redirect(noticesNewPath(areaId, returnTo, parsed.error));
  }

  if (
    !canWriteAreaNoticesForArea(
      profile.role,
      profile.businessAreaId,
      parsed.value.businessAreaId,
    )
  ) {
    redirect(
      noticesNewPath(
        areaId,
        returnTo,
        "Du saknar behörighet att skriva Aktuellt för området.",
      ),
    );
  }

  try {
    await createAreaNotice({
      businessAreaId: parsed.value.businessAreaId,
      kind: parsed.value.kind,
      title: parsed.value.title,
      body: parsed.value.body,
      endsOn: parsed.value.endsOn,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte spara inlägget.";
    redirect(noticesNewPath(areaId, returnTo, message));
  }

  revalidateNoticePaths();
  redirect(returnTo ?? "/admin/aktuellt");
}

export async function updateAreaNoticeAction(formData: FormData) {
  const profile = await requireOperationalWriter();
  const id = firstParam(formData.get("id"));
  const fields = readNoticeFields(formData);
  const returnTo = safeReturnTo(firstParam(formData.get("returnTo")));

  if (!id) {
    redirect("/admin/aktuellt?error=Saknar%20inläggs-id.");
  }

  const parsed = parseAreaNoticeFormValues(fields);
  if (!parsed.ok) {
    redirect(noticesEditPath(id, returnTo, parsed.error));
  }

  if (
    !canWriteAreaNoticesForArea(
      profile.role,
      profile.businessAreaId,
      parsed.value.businessAreaId,
    )
  ) {
    redirect(
      noticesEditPath(
        id,
        returnTo,
        "Du saknar behörighet att skriva Aktuellt för området.",
      ),
    );
  }

  try {
    await updateAreaNotice({
      id,
      businessAreaId: parsed.value.businessAreaId,
      kind: parsed.value.kind,
      title: parsed.value.title,
      body: parsed.value.body,
      endsOn: parsed.value.endsOn,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte uppdatera inlägget.";
    redirect(noticesEditPath(id, returnTo, message));
  }

  revalidateNoticePaths();
  redirect(returnTo ?? "/admin/aktuellt");
}

export type ArchiveAreaNoticeResult =
  | { ok: true }
  | { ok: false; error: string };

export async function archiveAreaNoticeAction(
  noticeId: string,
): Promise<ArchiveAreaNoticeResult> {
  await requireOperationalWriter();
  const id = noticeId.trim();
  if (!id) {
    return { ok: false, error: "Saknar inläggs-id." };
  }

  try {
    await archiveAreaNotice(id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte arkivera inlägget.";
    return { ok: false, error: message };
  }

  revalidateNoticePaths();
  return { ok: true };
}

export async function unarchiveAreaNoticeAction(
  noticeId: string,
): Promise<ArchiveAreaNoticeResult> {
  await requireOperationalWriter();
  const id = noticeId.trim();
  if (!id) {
    return { ok: false, error: "Saknar inläggs-id." };
  }

  try {
    await unarchiveAreaNotice(id);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Kunde inte återaktivera inlägget.";
    return { ok: false, error: message };
  }

  revalidateNoticePaths();
  return { ok: true };
}
