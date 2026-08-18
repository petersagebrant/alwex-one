import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { formatDateSv } from "@/lib/format/date";
import { getBusinessAreaOptions } from "@/services/businessAreas";
import { getActivities, getActivityById } from "@/services/activities";
import type { ActivityListItem } from "@/services/activities";
import { getGoals } from "@/services/goals";
import { ActivityFormFields } from "./ActivityFormFields";
import { createActivityAction, updateActivityAction } from "./actions";

export const metadata: Metadata = {
  title: "Administrera aktiviteter | LEIR",
  description: "Lista, skapa och uppdatera aktiviteter",
};

type AdminActivitiesPageProps = {
  searchParams: Promise<{ new?: string; edit?: string; error?: string }>;
};

const statusClass: Record<string, string> = {
  "Ej påbörjad": "bg-neutral-100 text-neutral-700",
  Pågår: "bg-indigo-50 text-indigo-700",
  Klar: "bg-emerald-50 text-emerald-700",
  Försenad: "bg-rose-50 text-rose-700",
};

const priorityClass: Record<string, string> = {
  Låg: "bg-neutral-100 text-neutral-700",
  Normal: "bg-amber-50 text-amber-800",
  Hög: "bg-rose-50 text-rose-700",
};

function ActivityDetailFields({
  activity,
}: {
  activity?: ActivityListItem | null;
}) {
  return (
    <>
      <div>
        <label
          htmlFor="title"
          className="block text-xs font-medium text-neutral-500"
        >
          Titel
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={activity?.title ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-xs font-medium text-neutral-500"
        >
          Beskrivning
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={activity?.description ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <div>
        <label
          htmlFor="owner"
          className="block text-xs font-medium text-neutral-500"
        >
          Ansvarig
        </label>
        <input
          id="owner"
          name="owner"
          type="text"
          defaultValue={activity?.owner ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <div>
        <label
          htmlFor="deadline"
          className="block text-xs font-medium text-neutral-500"
        >
          Deadline
        </label>
        <input
          id="deadline"
          name="deadline"
          type="date"
          defaultValue={activity?.deadline ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <div>
        <label
          htmlFor="priority"
          className="block text-xs font-medium text-neutral-500"
        >
          Prioritet
        </label>
        <select
          id="priority"
          name="priority"
          defaultValue={activity?.priority ?? "Normal"}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        >
          <option value="Låg">Låg</option>
          <option value="Normal">Normal</option>
          <option value="Hög">Hög</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="status"
          className="block text-xs font-medium text-neutral-500"
        >
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={activity?.status ?? "Ej påbörjad"}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        >
          <option value="Ej påbörjad">Ej påbörjad</option>
          <option value="Pågår">Pågår</option>
          <option value="Klar">Klar</option>
          <option value="Försenad">Försenad</option>
        </select>
      </div>
    </>
  );
}

export default async function AdminActivitiesPage({
  searchParams,
}: AdminActivitiesPageProps) {
  const params = await searchParams;
  const showCreate = params.new === "1";
  const editId = params.edit?.trim() || null;
  const error = params.error;

  const [activities, areas, goals, editingActivity] = await Promise.all([
    getActivities(),
    getBusinessAreaOptions(),
    getGoals(),
    editId ? getActivityById(editId).catch(() => null) : Promise.resolve(null),
  ]);

  const showEdit = Boolean(editId && editingActivity);

  const goalOptions = goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    businessAreaId: goal.businessAreaId,
  }));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="activities" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <Link href="/areas" className="hover:text-neutral-800">
                Affärsområden
              </Link>
              <span aria-hidden>/</span>
              <span className="text-neutral-800">Aktiviteter</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
              Administrera aktiviteter
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {activities.length} aktiviteter i databasen
            </p>
          </div>

          {!showCreate && !showEdit ? (
            <Link
              href="/admin/activities?new=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Ny aktivitet
            </Link>
          ) : null}
        </div>

        {error && !showCreate && !showEdit ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        {showCreate ? (
          <form
            action={createActivityAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <h2 className="text-sm font-semibold text-neutral-900">
              Ny aktivitet
            </h2>

            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="mt-4 space-y-4">
              <ActivityFormFields areas={areas} goals={goalOptions} />
              <ActivityDetailFields />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara
              </button>
              <Link
                href="/admin/activities"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {showEdit && editingActivity ? (
          <form
            action={updateActivityAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <input type="hidden" name="id" value={editingActivity.id} />
            <h2 className="text-sm font-semibold text-neutral-900">
              Ändra aktivitet
            </h2>

            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="mt-4 space-y-4">
              <ActivityFormFields
                areas={areas}
                goals={goalOptions}
                initialBusinessAreaId={editingActivity.businessAreaId}
                initialGoalId={editingActivity.goalId}
              />
              <ActivityDetailFields activity={editingActivity} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara ändringar
              </button>
              <Link
                href={`/activities/${editingActivity.id}`}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {editId && !editingActivity ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Aktiviteten hittades inte.
          </p>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">
              Alla aktiviteter
            </h2>
          </div>

          {activities.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">
              Inga aktiviteter ännu.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {activities.map((activity) => (
                <li key={activity.id}>
                  <Link
                    href={`/activities/${activity.id}`}
                    className="block cursor-pointer px-5 py-4 transition hover:bg-neutral-50 hover:shadow-[inset_3px_0_0_0_#111827]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">
                          {activity.title}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {activity.businessAreaName}
                          {activity.goalTitle
                            ? ` · Mål: ${activity.goalTitle}`
                            : null}
                          {activity.owner ? ` · ${activity.owner}` : null}
                          {activity.deadline
                            ? ` · Deadline ${formatDateSv(activity.deadline)}`
                            : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${priorityClass[activity.priority]}`}
                        >
                          {activity.priority}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusClass[activity.status]}`}
                        >
                          {activity.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
