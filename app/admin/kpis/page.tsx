import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { KpiAdminFormFields } from "@/components/admin/KpiAdminFormFields";
import { KpiArchiveControls } from "@/components/admin/KpiArchiveControls";
import { BeraknadTypeBadge } from "@/components/kpis/BeraknadTypeBadge";
import { StatistikTypeBadge } from "@/components/kpis/StatistikTypeBadge";
import { StatusBadge } from "@/components/ui";
import { requireProfile } from "@/lib/auth/require-user";
import { canManageBusinessAreas } from "@/lib/auth/roles";
import { isCalculatedKpi, isNonTargetKpi, isStatisticKpi } from "@/lib/kpi/kind";
import { getBusinessAreaOptions } from "@/services/businessAreas";
import { getKPIById, getKPIs, isKpiArchived } from "@/services/kpis";
import type { KPIListItem } from "@/services/kpis";
import { createKpiAction, updateKpiAction } from "./actions";

export const metadata: Metadata = {
  title: "Administrera KPI | LEIR",
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

export default async function AdminKpisPage({
  searchParams,
}: AdminKpisPageProps) {
  const params = await searchParams;
  const showCreate = params.new === "1";
  const editId = params.edit?.trim() || null;
  const error = params.error;

  const profile = await requireProfile();
  const canArchive = canManageBusinessAreas(profile.role);

  const [kpis, areas, editingKpi] = await Promise.all([
    getKPIs({ includeArchived: canArchive }).catch(() => [] as KPIListItem[]),
    getBusinessAreaOptions(),
    editId ? getKPIById(editId).catch(() => null) : Promise.resolve(null),
  ]);

  const activeKpis = kpis.filter((kpi) => !isKpiArchived(kpi));
  const archivedKpis = kpis.filter((kpi) => isKpiArchived(kpi));
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
              {activeKpis.length} aktiva
              {canArchive && archivedKpis.length > 0
                ? ` · ${archivedKpis.length} arkiverade`
                : null}
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
              <KpiAdminFormFields
                areas={areas}
                kpis={activeKpis.map((item) => ({
                  id: item.id,
                  name: item.name,
                  businessAreaId: item.businessAreaId,
                  kind: item.kind,
                }))}
              />
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
            {isKpiArchived(editingKpi) ? (
              <p className="mt-2 text-sm text-amber-800">
                Denna KPI är arkiverad. Historik behålls; återaktivera för att
                använda den i rapportering igen.
              </p>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="mt-4 space-y-4">
              <KpiAdminFormFields
                areas={areas}
                kpi={editingKpi}
                kpis={activeKpis.map((item) => ({
                  id: item.id,
                  name: item.name,
                  businessAreaId: item.businessAreaId,
                  kind: item.kind,
                }))}
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

        <KpiAdminListSection
          title="Aktiva KPI"
          kpis={activeKpis}
          canArchive={canArchive}
          emptyText="Inga aktiva KPI registrerade ännu."
        />

        {canArchive && archivedKpis.length > 0 ? (
          <KpiAdminListSection
            title="Arkiverade KPI"
            kpis={archivedKpis}
            canArchive={canArchive}
            emptyText="Inga arkiverade KPI."
          />
        ) : null}
      </main>
    </div>
  );
}

function KpiAdminListSection({
  title,
  kpis,
  canArchive,
  emptyText,
}: {
  title: string;
  kpis: KPIListItem[];
  canArchive: boolean;
  emptyText: string;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      </div>

      {kpis.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {kpis.map((kpi) => {
            const archived = isKpiArchived(kpi);
            return (
              <li key={kpi.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link
                    href={`/admin/kpis/${kpi.id}`}
                    className="min-w-0 flex-1 transition hover:opacity-90"
                  >
                    <p className="font-medium text-neutral-900">
                      {kpi.name}
                      {archived ? (
                        <span className="ml-2 text-xs font-semibold text-neutral-500">
                          Arkiverad
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {kpi.businessAreaName}
                      {kpi.category ? ` · ${kpi.category}` : null}
                      {isStatisticKpi(kpi)
                        ? " · Typ: Statistik"
                        : isCalculatedKpi(kpi)
                          ? " · Typ: Beräknad"
                          : null}
                      {kpi.currentValue
                        ? ` · ${kpi.currentValue}${kpi.unit ? ` ${kpi.unit}` : ""}`
                        : null}
                      {!isNonTargetKpi(kpi) && kpi.targetValue
                        ? ` · Mål ${kpi.targetValue}${kpi.unit ? ` ${kpi.unit}` : ""}`
                        : null}
                    </p>
                  </Link>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isStatisticKpi(kpi) ? (
                        <StatistikTypeBadge />
                      ) : isCalculatedKpi(kpi) ? (
                        <BeraknadTypeBadge />
                      ) : kpi.status !== "Statistik" ? (
                        <StatusBadge status={kpi.status} />
                      ) : null}
                      <TrendBadge trend={kpi.trend} />
                    </div>
                    {canArchive ? (
                      <KpiArchiveControls
                        kpiId={kpi.id}
                        kpiName={kpi.name}
                        businessAreaName={kpi.businessAreaName}
                        archived={archived}
                      />
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
