import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  createBusinessAreaAction,
  updateBusinessAreaAction,
} from "./actions";
import {
  getBusinessAreaById,
  type BusinessAreaDetail,
} from "@/services/businessAreas";

export const metadata: Metadata = {
  title: "Administrera affärsområden | Alwex One",
  description: "Skapa och uppdatera affärsområden",
};

type AdminBusinessAreasPageProps = {
  searchParams: Promise<{ edit?: string; error?: string }>;
};

const fieldClassName =
  "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20";

function BusinessAreaFormFields({
  area,
  includeVdComment = false,
}: {
  area?: BusinessAreaDetail | null;
  includeVdComment?: boolean;
}) {
  return (
    <>
      <div>
        <label
          htmlFor="name"
          className="block text-xs font-medium text-neutral-500"
        >
          Namn
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={area?.name ?? ""}
          className={fieldClassName}
        />
      </div>

      <div>
        <label
          htmlFor="manager"
          className="block text-xs font-medium text-neutral-500"
        >
          Ansvarig
        </label>
        <input
          id="manager"
          name="manager"
          type="text"
          defaultValue={area?.manager ?? ""}
          className={fieldClassName}
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
          rows={4}
          defaultValue={area?.description ?? ""}
          className={fieldClassName}
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
          defaultValue={area?.status ?? "Gul"}
          className={fieldClassName}
        >
          <option value="Grön">Grön</option>
          <option value="Gul">Gul</option>
          <option value="Röd">Röd</option>
        </select>
      </div>

      {includeVdComment ? (
        <div>
          <label
            htmlFor="vdComment"
            className="block text-xs font-medium text-neutral-500"
          >
            VD-kommentar
          </label>
          <textarea
            id="vdComment"
            name="vdComment"
            rows={4}
            defaultValue={area?.vdComment ?? ""}
            className={fieldClassName}
          />
        </div>
      ) : null}
    </>
  );
}

export default async function AdminBusinessAreasPage({
  searchParams,
}: AdminBusinessAreasPageProps) {
  const params = await searchParams;
  const editId = params.edit?.trim() || null;
  const error = params.error;

  const editingArea = editId
    ? await getBusinessAreaById(editId).catch(() => null)
    : null;
  const showEdit = Boolean(editId && editingArea);
  const showCreate = !editId;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="areas" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <Link href="/areas" className="hover:text-neutral-800">
              Affärsområden
            </Link>
            <span aria-hidden>/</span>
            {showEdit && editingArea ? (
              <>
                <Link
                  href={`/areas/${editingArea.slug}`}
                  className="hover:text-neutral-800"
                >
                  {editingArea.name}
                </Link>
                <span aria-hidden>/</span>
                <span className="text-neutral-800">Redigera</span>
              </>
            ) : (
              <span className="text-neutral-800">Administration</span>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
            {showEdit ? "Redigera affärsområde" : "Nytt affärsområde"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {showEdit
              ? "Uppdatera uppgifterna och spara till databasen."
              : "Fyll i uppgifterna och spara till databasen."}
          </p>
        </div>

        {editId && !editingArea ? (
          <p className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Affärsområdet hittades inte.
          </p>
        ) : null}

        {showEdit && editingArea ? (
          <form
            action={updateBusinessAreaAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <input type="hidden" name="id" value={editingArea.id} />

            {error ? (
              <p className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="space-y-4">
              <BusinessAreaFormFields area={editingArea} includeVdComment />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
              >
                Spara
              </button>
              <Link
                href={`/areas/${editingArea.slug}`}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {showCreate ? (
          <form
            action={createBusinessAreaAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            {error ? (
              <p className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="space-y-4">
              <BusinessAreaFormFields />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
              >
                Spara
              </button>
              <Link
                href="/areas"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  );
}
