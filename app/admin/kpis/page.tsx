import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatusBadge } from "@/components/ui";
import { getBusinessAreaOptions } from "@/services/businessAreas";
import { getKPIById, getKPIs } from "@/services/kpis";
import type { KPIListItem } from "@/services/kpis";
import { createKpiAction, updateKpiAction } from "./actions";

export const metadata: Metadata = {
  title: "Administrera KPI | Alwex One",
  description: "Lista, skapa och uppdatera nyckeltal",
};

type AdminKpisPageProps = {
  searchParams: Promise<{ new?: string; edit?: string; error?: string }>;
};

const trendClass: Record<string, string> = {
  Upp: "bg-emerald-50 text-emerald-700",
  Oförändrad: "bg-neutral-100 text-neutral-700",
  Ner: "bg-rose-50 text-rose-700",
};

function TrendBadge({ trend }: { trend: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${trendClass[trend] ?? trendClass.Oförändrad}`}
    >
      {trend}
    </span>
  );
}

function KpiFormFields({
  areas,
  kpi,
}: {
  areas: { id: string; name: string }[];
  kpi?: KPIListItem | null;
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
          defaultValue={kpi?.businessAreaId ?? ""}
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
          defaultValue={kpi?.name ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <div>
        <label
          htmlFor="category"
          className="block text-xs font-medium text-neutral-500"
        >
          Kategori
        </label>
        <input
          id="category"
          name="category"
          type="text"
          defaultValue={kpi?.category ?? ""}
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="currentValue"
            className="block text-xs font-medium text-neutral-500"
          >
            Nuvarande värde
          </label>
          <input
            id="currentValue"
            name="currentValue"
            type="text"
            defaultValue={kpi?.currentValue ?? ""}
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
            defaultValue={kpi?.targetValue ?? ""}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>

        <div>
          <label
            htmlFor="unit"
            className="block text-xs font-medium text-neutral-500"
          >
            Enhet
          </label>
          <input
            id="unit"
            name="unit"
            type="text"
            defaultValue={kpi?.unit ?? ""}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            defaultValue={kpi?.status ?? "Gul"}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          >
            <option value="Grön">Grön</option>
            <option value="Gul">Gul</option>
            <option value="Röd">Röd</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="trend"
            className="block text-xs font-medium text-neutral-500"
          >
            Trend
          </label>
          <select
            id="trend"
            name="trend"
            defaultValue={kpi?.trend ?? "Oförändrad"}
            className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
          >
            <option value="Upp">Upp</option>
            <option value="Oförändrad">Oförändrad</option>
            <option value="Ner">Ner</option>
          </select>
        </div>
      </div>
    </>
  );
}

export default async function AdminKpisPage({
  searchParams,
}: AdminKpisPageProps) {
  const params = await searchParams;
  const showCreate = params.new === "1";
  const editId = params.edit?.trim() || null;
  const error = params.error;

  const [kpis, areas, editingKpi] = await Promise.all([
    getKPIs().catch(() => [] as KPIListItem[]),
    getBusinessAreaOptions(),
    editId ? getKPIById(editId).catch(() => null) : Promise.resolve(null),
  ]);

  const showEdit = Boolean(editId && editingKpi);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="kpis" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <Link href="/areas" className="hover:text-neutral-800">
                Affärsområden
              </Link>
              <span aria-hidden>/</span>
              <span className="text-neutral-800">KPI</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
              Administrera KPI
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {kpis.length} KPI i databasen
            </p>
          </div>

          {!showCreate && !showEdit ? (
            <Link
              href="/admin/kpis?new=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Ny KPI
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
            action={createKpiAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <h2 className="text-sm font-semibold text-neutral-900">Ny KPI</h2>

            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="mt-4 space-y-4">
              <KpiFormFields areas={areas} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara
              </button>
              <Link
                href="/admin/kpis"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {showEdit && editingKpi ? (
          <form
            action={updateKpiAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <input type="hidden" name="id" value={editingKpi.id} />
            <h2 className="text-sm font-semibold text-neutral-900">Ändra KPI</h2>

            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="mt-4 space-y-4">
              <KpiFormFields areas={areas} kpi={editingKpi} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara ändringar
              </button>
              <Link
                href="/admin/kpis"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {editId && !editingKpi ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            KPI hittades inte.
          </p>
        ) : null}

        <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Alla KPI</h2>
          </div>

          {kpis.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">
              Inga KPI registrerade ännu.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {kpis.map((kpi) => (
                <li key={kpi.id}>
                  <Link
                    href={`/admin/kpis/${kpi.id}`}
                    className="block cursor-pointer px-5 py-4 transition hover:bg-neutral-50 hover:shadow-[inset_3px_0_0_0_#111827]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">
                          {kpi.name}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {kpi.businessAreaName}
                          {kpi.category ? ` · ${kpi.category}` : null}
                          {kpi.currentValue
                            ? ` · ${kpi.currentValue}${kpi.unit ? ` ${kpi.unit}` : ""}`
                            : null}
                          {kpi.targetValue
                            ? ` · Mål ${kpi.targetValue}${kpi.unit ? ` ${kpi.unit}` : ""}`
                            : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={kpi.status} />
                        <TrendBadge trend={kpi.trend} />
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
