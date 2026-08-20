"use server";

import { redirect } from "next/navigation";
import { requireUserAdministrator } from "@/lib/auth/require-user";
import {
  inviteUser,
  sendUserAccessLink,
  setUserDisabled,
  updateUser,
} from "@/services/users";

function usersPath(query?: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  return search ? `/admin/users?${search}` : "/admin/users";
}

function fail(path: string, error: unknown, fallback: string): never {
  const message = error instanceof Error ? error.message : fallback;
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

export async function inviteUserAction(formData: FormData) {
  const actor = await requireUserAdministrator();

  try {
    await inviteUser(actor.id, {
      displayName: formData.get("displayName"),
      email: formData.get("email"),
      role: formData.get("role"),
      businessAreaId: formData.get("businessAreaId"),
    });
  } catch (error) {
    fail(usersPath({ new: "1" }), error, "Kunde inte bjuda in användaren.");
  }

  redirect(usersPath({ message: "Inbjudan skickad." }));
}

export async function updateUserAction(formData: FormData) {
  const actor = await requireUserAdministrator();
  const id = String(formData.get("id") ?? "");
  const editPath = usersPath({ edit: id });

  try {
    await updateUser(actor.id, {
      id,
      displayName: formData.get("displayName"),
      role: formData.get("role"),
      businessAreaId: formData.get("businessAreaId"),
    });
  } catch (error) {
    fail(editPath, error, "Kunde inte uppdatera användaren.");
  }

  redirect(usersPath({ message: "Användaren uppdaterad." }));
}

export async function setUserDisabledAction(formData: FormData) {
  const actor = await requireUserAdministrator();
  const id = String(formData.get("id") ?? "");
  const disabled = String(formData.get("disabled") ?? "") === "1";

  try {
    await setUserDisabled(actor.id, id, disabled);
  } catch (error) {
    fail(
      usersPath(),
      error,
      disabled ? "Kunde inte inaktivera användaren." : "Kunde inte återaktivera användaren.",
    );
  }

  redirect(
    usersPath({
      message: disabled ? "Användaren inaktiverad." : "Användaren återaktiverad.",
    }),
  );
}

export async function sendUserAccessLinkAction(formData: FormData) {
  const actor = await requireUserAdministrator();
  const id = String(formData.get("id") ?? "");

  try {
    await sendUserAccessLink(actor.id, id);
  } catch (error) {
    fail(usersPath(), error, "Kunde inte skicka länk.");
  }

  redirect(usersPath({ message: "Ny länk skickad." }));
}
