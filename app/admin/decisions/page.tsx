import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { formatDateSv } from "@/lib/format/date";
import { getBusinessAreaOptions } from "@/services/businessAreas";
import { getDecisionById, getDecisions } from "@/services/decisions";
import type { DecisionListItem } from "@/services/decisions";
import {
  createDecisionAction,
  markDecisionCompleteAction,
  updateDecisionAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Administrera beslut | Alwex One",
  description: "Lista, skapa och uppdatera beslut",
};

type AdminDecisionsPageProps = {
  searchParams: Promise<{ new?: string; edit?: string; error?: string }>;
};

const statusClass: Record<string, string> = {
  Planerat: "bg-neutral-100 text-neutral-700",
  Pågår: "bg-indigo-50 text-indigo-700",
  Klart: "bg-emerald-50 text-emerald-700",
};

function DecisionFormFields({
  areas,
  decision,
}: {
  areas: { id: string; name: string }[];
  decision?: DecisionListItem | null;
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
          defaultValue={decision?.businessAreaId ?? ""}
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
          defaultValue={decision?.title ?? ""}
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
          defaultValue={decision?.description ?? ""}
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
          defaultValue={decision?.owner ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="meetingDate"
            className="block text-xs font-medium text-neutral-500"
          >
            Mötesdatum
          </label>
          <input
            id="meetingDate"
            name="meetingDate"
            type="date"
            defaultValue={decision?.meetingDate ?? ""}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>

        <div>
          <label
            htmlFor="dueDate"
            className="block text-xs font-medium text-neutral-500"
          >
            Förfallodatum
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={decision?.dueDate ?? ""}
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
          defaultValue={decision?.status ?? "Planerat"}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        >
          <option value="Planerat">Planerat</option>
          <option value="Pågår">Pågår</option>
          <option value="Klart">Klart</option>
        </select>
      </div>
    </>
  );
}

export default async function AdminDecisionsPage({
  searchParams,
}: AdminDecisionsPageProps) {
  const params = await searchParams;
  const showCreate = params.new === "1";
  const editId = params.edit?.trim() || null;
  const error = params.error;

  const [decisions, areas, editingDecision] = await Promise.all([
    getDecisions(),
    getBusinessAreaOptions(),
    editId ? getDecisionById(editId) : Promise.resolve(null),
  ]);

  const showEdit = Boolean(editId && editingDecision);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="decisions" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <Link href="/areas" className="hover:text-neutral-800">
                Affärsområden
              </Link>
              <span aria-hidden>/</span>
              <span className="text-neutral-800">Beslut</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
              Administrera beslut
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {decisions.length} beslut i databasen
            </p>
          </div>

          {!showCreate && !showEdit ? (
            <Link
              href="/admin/decisions?new=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Nytt beslut
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
            action={createDecisionAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <h2 className="text-sm font-semibold text-neutral-900">
              Nytt beslut
            </h2>

            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="mt-4 space-y-4">
              <DecisionFormFields areas={areas} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara
              </button>
              <Link
                href="/admin/decisions"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {showEdit && editingDecision ? (
          <form
            action={updateDecisionAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <input type="hidden" name="id" value={editingDecision.id} />
            <h2 className="text-sm font-semibold text-neutral-900">
              Ändra beslut
            </h2>

            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="mt-4 space-y-4">
              <DecisionFormFields areas={areas} decision={editingDecision} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara ändringar
              </button>
              <Link
                href={`/admin/decisions/${editingDecision.id}`}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {editId && !editingDecision ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Beslutet hittades inte.
          </p>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">
              Alla beslut
            </h2>
          </div>

          {decisions.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">
              Inga beslut ännu.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {decisions.map((decision) => (
                <li key={decision.id}>
                  <Link
                    href={`/admin/decisions/${decision.id}`}
                    className="block cursor-pointer px-5 py-4 transition hover:bg-neutral-50 hover:shadow-[inset_3px_0_0_0_#111827]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">
                          {decision.title}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {decision.businessAreaName}
                          {decision.owner ? ` · ${decision.owner}` : null}
                          {decision.meetingDate
                            ? ` · Möte ${formatDateSv(decision.meetingDate)}`
                            : null}
                          {decision.dueDate
                            ? ` · Förfaller ${formatDateSv(decision.dueDate)}`
                            : null}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass[decision.status] ?? statusClass.Planerat}`}
                      >
                        {decision.status}
                      </span>
                    </div>
                  </Link>
                  <div className="flex flex-wrap items-center gap-3 px-5 pb-4">
                    <Link
                      href={`/admin/decisions?edit=${decision.id}`}
                      className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline"
                    >
                      Ändra
                    </Link>
                    {decision.status !== "Klart" ? (
                      <form action={markDecisionCompleteAction}>
                        <input type="hidden" name="id" value={decision.id} />
                        <button
                          type="submit"
                          className="text-sm font-medium text-emerald-700 underline-offset-4 hover:underline"
                        >
                          Markera klart
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
