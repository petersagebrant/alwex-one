import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatusBadge } from "@/components/ui";
import { requireUserAdministrator } from "@/lib/auth/require-user";
import { getOperationalAreaNoticeOptions } from "@/services/areaNotices";
import {
  getReportingUnits,
  type ReportingUnitListItem,
} from "@/services/reportingUnits";
import {
  createReportingUnitAction,
  setReportingUnitActiveAction,
  updateReportingUnitAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Rapportenheter",
  description: "Administrera enheter som kan rapportera till Alwex",
};

type AdminReportingUnitsPageProps = {
  searchParams: Promise<{
    new?: string;
    edit?: string;
    error?: string;
    message?: string;
  }>;
};

const fieldClassName =
  "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20";

function ReportingUnitFormFields({
  unit,
  areas,
}: {
  unit?: ReportingUnitListItem | null;
  areas: { id: string; name: string }[];
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
          maxLength={120}
          defaultValue={unit?.name ?? ""}
          className={fieldClassName}
        />
      </div>

      <div>
        <label
          htmlFor="code"
          className="block text-xs font-medium text-neutral-500"
        >
          Kod
        </label>
        <input
          id="code"
          name="code"
          type="text"
          maxLength={60}
          defaultValue={unit?.code ?? ""}
          placeholder="t.ex. testakeri"
          className={fieldClassName}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Unik slug. Lämna tom vid skapande så föreslås den från namnet.
        </p>
      </div>

      <div>
        <label
          htmlFor="defaultBusinessAreaId"
          className="block text-xs font-medium text-neutral-500"
        >
          Förvalt affärsområde
        </label>
        <select
          id="defaultBusinessAreaId"
          name="defaultBusinessAreaId"
          defaultValue={unit?.defaultBusinessAreaId ?? ""}
          className={fieldClassName}
        >
          <option value="">Ingen förvald</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-neutral-800">
        <input
          type="checkbox"
          name="isActive"
          value="1"
          defaultChecked={unit?.isActive ?? true}
          className="h-4 w-4"
        />
        Aktiv
      </label>
    </>
  );
}

export default async function AdminReportingUnitsPage({
  searchParams,
}: AdminReportingUnitsPageProps) {
  await requireUserAdministrator();
  const params = await searchParams;
  const showCreate = params.new === "1";
  const editId = params.edit?.trim() || null;
  const error = params.error;
  const message = params.message;

  const [units, areas] = await Promise.all([
    getReportingUnits(),
    getOperationalAreaNoticeOptions(),
  ]);
  const editingUnit = editId
    ? (units.find((unit) => unit.id === editId) ?? null)
    : null;
  const showEdit = Boolean(editId && editingUnit);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="users" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <span>Admin</span>
              <span aria-hidden>/</span>
              <Link href="/admin/users" className="hover:text-neutral-800">
                Användare
              </Link>
              <span aria-hidden>/</span>
              <span className="text-neutral-800">Rapportenheter</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
              Rapportenheter
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Enheter som visas i Rapporterat från på /rapportera.
            </p>
          </div>

          {!showCreate && !showEdit ? (
            <Link
              href="/admin/reporting-units?new=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Skapa rapportenhet
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
            action={createReportingUnitAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <h2 className="text-sm font-semibold text-neutral-900">
              Skapa rapportenhet
            </h2>
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <ReportingUnitFormFields areas={areas} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Skapa
              </button>
              <Link
                href="/admin/reporting-units"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {showEdit && editingUnit ? (
          <form
            action={updateReportingUnitAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <input type="hidden" name="id" value={editingUnit.id} />
            <h2 className="text-sm font-semibold text-neutral-900">
              Redigera rapportenhet
            </h2>
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <ReportingUnitFormFields unit={editingUnit} areas={areas} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara
              </button>
              <Link
                href="/admin/reporting-units"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {editId && !editingUnit ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Rapportenheten hittades inte.
          </p>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">
              Alla rapportenheter
            </h2>
          </div>

          {units.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">
              Inga rapportenheter ännu.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {units.map((unit) => (
                <li key={unit.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">{unit.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {unit.code}
                        {unit.defaultBusinessAreaName
                          ? ` · ${unit.defaultBusinessAreaName}`
                          : " · Inget förvalt affärsområde"}
                      </p>
                    </div>
                    <StatusBadge
                      status={unit.isActive ? "Grön" : "Grå"}
                      label={unit.isActive ? "Aktiv" : "Inaktiv"}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link
                      href={`/admin/reporting-units?edit=${encodeURIComponent(unit.id)}`}
                      className="text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                    >
                      Ändra
                    </Link>
                    <form action={setReportingUnitActiveAction}>
                      <input type="hidden" name="id" value={unit.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={unit.isActive ? "0" : "1"}
                      />
                      <button
                        type="submit"
                        className="text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                      >
                        {unit.isActive ? "Inaktivera" : "Återaktivera"}
                      </button>
                    </form>
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
