import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatusBadge } from "@/components/ui";
import { formatDateSv } from "@/lib/format/date";
import { getBusinessAreaOptions } from "@/services/businessAreas";
import { getGoalById, getGoals } from "@/services/goals";
import type { GoalListItem } from "@/services/goals";
import { createGoalAction, updateGoalAction } from "./actions";

export const metadata: Metadata = {
  title: "Administrera mål | Alwex One",
  description: "Lista, skapa och uppdatera mål",
};

type AdminGoalsPageProps = {
  searchParams: Promise<{ new?: string; edit?: string; error?: string }>;
};

function GoalFormFields({
  areas,
  goal,
}: {
  areas: { id: string; name: string }[];
  goal?: GoalListItem | null;
}) {
  return (
    <>
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
          required
          defaultValue={goal?.businessAreaId ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        >
          <option value="" disabled>
            Välj affärsområde
          </option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

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
          defaultValue={goal?.title ?? ""}
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
          defaultValue={goal?.description ?? ""}
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
          defaultValue={goal?.owner ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            defaultValue={goal?.deadline ?? ""}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>
        <div>
          <label
            htmlFor="progress"
            className="block text-xs font-medium text-neutral-500"
          >
            Progress (%)
          </label>
          <input
            id="progress"
            name="progress"
            type="number"
            min={0}
            max={100}
            defaultValue={goal?.progress ?? ""}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="currentValue"
            className="block text-xs font-medium text-neutral-500"
          >
            Aktuellt värde
          </label>
          <input
            id="currentValue"
            name="currentValue"
            type="text"
            defaultValue={goal?.currentValue ?? ""}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>
        <div>
          <label
            htmlFor="targetValue"
            className="block text-xs font-medium text-neutral-500"
          >
            Målvärde
          </label>
          <input
            id="targetValue"
            name="targetValue"
            type="text"
            defaultValue={goal?.targetValue ?? ""}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>
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
          defaultValue={goal?.status ?? "Gul"}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        >
          <option value="Grön">Grön</option>
          <option value="Gul">Gul</option>
          <option value="Röd">Röd</option>
        </select>
      </div>
    </>
  );
}

export default async function AdminGoalsPage({
  searchParams,
}: AdminGoalsPageProps) {
  const params = await searchParams;
  const showCreate = params.new === "1";
  const editId = params.edit?.trim() || null;
  const error = params.error;

  const [goals, areas, editingGoal] = await Promise.all([
    getGoals(),
    getBusinessAreaOptions(),
    editId ? getGoalById(editId).catch(() => null) : Promise.resolve(null),
  ]);

  const showEdit = Boolean(editId && editingGoal);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="goals" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <Link href="/areas" className="hover:text-neutral-800">
                Affärsområden
              </Link>
              <span aria-hidden>/</span>
              <span className="text-neutral-800">Mål</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
              Administrera mål
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {goals.length} mål i databasen
            </p>
          </div>

          {!showCreate && !showEdit ? (
            <Link
              href="/admin/goals?new=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Nytt mål
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
            action={createGoalAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <h2 className="text-sm font-semibold text-neutral-900">Nytt mål</h2>
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <GoalFormFields areas={areas} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara
              </button>
              <Link
                href="/admin/goals"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {showEdit && editingGoal ? (
          <form
            action={updateGoalAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <input type="hidden" name="id" value={editingGoal.id} />
            <h2 className="text-sm font-semibold text-neutral-900">Ändra mål</h2>
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <GoalFormFields areas={areas} goal={editingGoal} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara ändringar
              </button>
              <Link
                href={`/admin/goals/${editingGoal.id}`}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {editId && !editingGoal ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Målet hittades inte.
          </p>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Alla mål</h2>
          </div>

          {goals.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">Inga mål ännu.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {goals.map((goal) => (
                <li key={goal.id}>
                  <Link
                    href={`/admin/goals/${goal.id}`}
                    className="block cursor-pointer px-5 py-4 transition hover:bg-neutral-50 hover:shadow-[inset_3px_0_0_0_#111827]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">
                          {goal.title}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {goal.businessAreaName}
                          {goal.owner ? ` · ${goal.owner}` : null}
                          {goal.deadline
                            ? ` · Deadline ${formatDateSv(goal.deadline)}`
                            : null}
                          {goal.targetValue
                            ? ` · Målvärde ${goal.targetValue}`
                            : null}
                        </p>
                      </div>
                      <StatusBadge status={goal.status} />
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
