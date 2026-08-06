import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { formatDateSv } from "@/lib/format/date";
import { getBusinessAreaOptions } from "@/services/businessAreas";
import { getGoals } from "@/services/goals";
import { createGoalAction } from "./actions";

export const metadata: Metadata = {
  title: "Administrera mål | Alwex One",
  description: "Lista och skapa mål",
};

type AdminGoalsPageProps = {
  searchParams: Promise<{ new?: string; error?: string }>;
};

export default async function AdminGoalsPage({
  searchParams,
}: AdminGoalsPageProps) {
  const params = await searchParams;
  const showForm = params.new === "1";
  const error = params.error;

  const [goals, areas] = await Promise.all([
    getGoals(),
    getBusinessAreaOptions(),
  ]);

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

          {!showForm ? (
            <Link
              href="/admin/goals?new=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Nytt mål
            </Link>
          ) : null}
        </div>

        {showForm ? (
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
                  defaultValue=""
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
                  className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
                />
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
                  defaultValue="Gul"
                  className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
                >
                  <option value="Grön">Grön</option>
                  <option value="Gul">Gul</option>
                  <option value="Röd">Röd</option>
                </select>
              </div>
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

        <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Alla mål</h2>
          </div>

          {goals.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">
              Inga mål ännu.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {goals.map((goal) => (
                <li key={goal.id} className="px-5 py-4">
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
                    <StatusPill status={goal.status} />
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
