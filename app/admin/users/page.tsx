import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { SetUserPasswordControls } from "@/components/admin/SetUserPasswordControls";
import { StatusBadge } from "@/components/ui";
import { requireUserAdministrator } from "@/lib/auth/require-user";
import {
  APP_ROLES,
  APP_ROLE_LABELS,
  canSetUserPassword,
} from "@/lib/auth/roles";
import { getBusinessAreaOptions } from "@/services/businessAreas";
import { getAdminUsers, type AdminUserListItem } from "@/services/users";
import {
  inviteUserAction,
  sendUserAccessLinkAction,
  setUserDisabledAction,
  updateUserAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Administrera användare | LEIR",
  description: "Bjud in, ändra roll och inaktivera användare",
};

type AdminUsersPageProps = {
  searchParams: Promise<{
    new?: string;
    edit?: string;
    error?: string;
    message?: string;
  }>;
};

const fieldClassName =
  "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20";

function UserFormFields({
  areas,
  user,
  lockRole,
  lockArea,
}: {
  areas: { id: string; name: string }[];
  user?: AdminUserListItem | null;
  lockRole?: boolean;
  lockArea?: boolean;
}) {
  return (
    <>
      <div>
        <label
          htmlFor="displayName"
          className="block text-xs font-medium text-neutral-500"
        >
          Namn
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          maxLength={120}
          defaultValue={user?.rawDisplayName ?? ""}
          className={fieldClassName}
        />
      </div>

      {user ? null : (
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-neutral-500"
          >
            E-post
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            required
            className={fieldClassName}
          />
        </div>
      )}

      <div>
        <label
          htmlFor="role"
          className="block text-xs font-medium text-neutral-500"
        >
          Roll
        </label>
        <select
          id="role"
          name="role"
          required
          defaultValue={user?.role ?? ""}
          disabled={lockRole}
          className={fieldClassName}
        >
          <option value="" disabled>
            Välj roll
          </option>
          {APP_ROLES.map((role) => (
            <option key={role} value={role}>
              {APP_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        {lockRole ? (
          <input type="hidden" name="role" value={user?.role ?? ""} />
        ) : null}
      </div>

      <div>
        <label
          htmlFor="businessAreaId"
          className="block text-xs font-medium text-neutral-500"
        >
          Affärsområde
        </label>
        <select
          id="businessAreaId"
          name="businessAreaId"
          defaultValue={user?.businessAreaId ?? ""}
          disabled={lockArea}
          className={fieldClassName}
        >
          <option value="">Inget (alla roller utom AO-chef)</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
        {lockArea ? (
          <input
            type="hidden"
            name="businessAreaId"
            value={user?.businessAreaId ?? ""}
          />
        ) : null}
        <p className="mt-1.5 text-xs text-neutral-500">
          Obligatoriskt för AO-chef. Övriga roller ska inte ha affärsområde.
        </p>
      </div>
    </>
  );
}

function UserStatusBadge({ status }: { status: AdminUserListItem["status"] }) {
  if (status === "inactive") {
    return <StatusBadge status="Grå" label="Inaktiv" />;
  }
  return <StatusBadge status="Grön" label="Aktiv" />;
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const params = await searchParams;
  const actor = await requireUserAdministrator();
  const showCreate = params.new === "1";
  const editId = params.edit?.trim() || null;
  const error = params.error;
  const message = params.message;

  const areas = await getBusinessAreaOptions();
  const areaNames = new Map(areas.map((area) => [area.id, area.name]));
  const users = await getAdminUsers({ actorId: actor.id, areaNames });
  const canSetPassword = canSetUserPassword(actor.role);
  const editingUser = editId
    ? (users.find((user) => user.id === editId) ?? null)
    : null;
  const showEdit = Boolean(editId && editingUser);
  const lockRole = Boolean(
    editingUser && (editingUser.isSelf || editingUser.protected),
  );
  const lockArea = Boolean(editingUser?.isSelf);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="users" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <span>Admin</span>
              <span aria-hidden>/</span>
              <span className="text-neutral-800">Användare</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
              Administrera användare
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {users.length} användare · inbjudan via e-post
            </p>
          </div>

          {!showCreate && !showEdit ? (
            <Link
              href="/admin/users?new=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Bjud in användare
            </Link>
          ) : null}
        </div>

        {message && !showCreate && !showEdit ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {message}
          </p>
        ) : null}

        {error && !showCreate && !showEdit ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        {showCreate ? (
          <form
            action={inviteUserAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <h2 className="text-sm font-semibold text-neutral-900">
              Bjud in användare
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Personen får en e-postlänk och sätter lösenord själv.
            </p>
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <UserFormFields areas={areas} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Skicka inbjudan
              </button>
              <Link
                href="/admin/users"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {showEdit && editingUser ? (
          <form
            action={updateUserAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <input type="hidden" name="id" value={editingUser.id} />
            <h2 className="text-sm font-semibold text-neutral-900">
              Ändra användare
            </h2>
            {editingUser.isSelf ? (
              <p className="mt-1 text-sm text-neutral-500">
                Du kan inte ändra din egen roll eller affärsområde.
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <UserFormFields
                areas={areas}
                user={editingUser}
                lockRole={lockRole}
                lockArea={lockArea}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara ändringar
              </button>
              <Link
                href="/admin/users"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {editId && !editingUser ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Användaren hittades inte.
          </p>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">
              Alla användare
            </h2>
          </div>

          {users.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">
              Inga användare ännu.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {users.map((user) => (
                <li key={user.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">
                        {user.displayName}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {user.email ?? "E-post saknas"}
                        {` · ${user.roleLabel}`}
                        {user.businessAreaName
                          ? ` · ${user.businessAreaName}`
                          : null}
                        {user.invitedPending ? " · Inbjudan skickad" : null}
                        {user.protected ? " · Skyddat konto" : null}
                      </p>
                    </div>
                    <UserStatusBadge status={user.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link
                      href={`/admin/users?edit=${encodeURIComponent(user.id)}`}
                      className="text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                    >
                      Ändra
                    </Link>

                    {!user.isSelf && user.status === "active" ? (
                      <form action={sendUserAccessLinkAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                        >
                          {user.invitedPending
                            ? "Skicka ny inbjudan"
                            : "Skicka lösenordsåterställning"}
                        </button>
                      </form>
                    ) : null}

                    {canSetPassword && !user.isSelf ? (
                      <SetUserPasswordControls
                        userId={user.id}
                        displayName={user.displayName}
                        email={user.email}
                      />
                    ) : null}

                    {!user.isSelf && !user.protected ? (
                      <form action={setUserDisabledAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <input
                          type="hidden"
                          name="disabled"
                          value={user.status === "active" ? "1" : "0"}
                        />
                        <button
                          type="submit"
                          className="text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                        >
                          {user.status === "active"
                            ? "Inaktivera"
                            : "Återaktivera"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
