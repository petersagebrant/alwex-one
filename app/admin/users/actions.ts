"use server";

import { redirect } from "next/navigation";
import {
  requireCanSetUserPassword,
  requireUserAdministrator,
} from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import {
  createUser,
  sendUserAccessLink,
  setOwnAccountPassword,
  setUserDisabled,
  setUserTemporaryPassword,
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

export async function createUserAction(formData: FormData) {
  const actor = await requireUserAdministrator();

  let createdId = "";
  try {
    const created = await createUser(actor.id, {
      displayName: formData.get("displayName"),
      email: formData.get("email"),
      role: formData.get("role"),
      businessAreaId: formData.get("businessAreaId"),
    });
    createdId = created.id;
  } catch (error) {
    fail(usersPath({ new: "1" }), error, "Kunde inte skapa användaren.");
  }

  redirect(
    usersPath({
      created: createdId,
      message: "Användaren skapad. Ange ett tillfälligt lösenord så att personen kan logga in.",
    }),
  );
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

export type SetUserPasswordResult =
  | { ok: true; mode: "temporary"; password: string; email: string | null }
  | { ok: true; mode: "own"; email: string | null }
  | { ok: false; error: string };

export async function setUserPasswordAction(
  userId: string,
  ownPassword?: string,
): Promise<SetUserPasswordResult> {
  const actor = await requireCanSetUserPassword();
  const id = userId.trim();
  if (!id) {
    return { ok: false, error: "Saknar användar-id." };
  }

  try {
    if (actor.id === id) {
      const result = await setOwnAccountPassword(actor.id, ownPassword);
      if (actor.email && typeof ownPassword === "string") {
        try {
          const supabase = await createClient();
          await supabase.auth.signInWithPassword({
            email: actor.email,
            password: ownPassword,
          });
        } catch {
          // Password is already saved. Admin updateUserById can revoke sessions.
        }
      }
      return { ok: true, mode: "own", email: result.email };
    }

    const result = await setUserTemporaryPassword(actor.id, id);
    return {
      ok: true,
      mode: "temporary",
      password: result.password,
      email: result.email,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kunde inte ange nytt lösenord.";
    return { ok: false, error: message };
  }
}
