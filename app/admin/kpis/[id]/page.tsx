import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { KpiHistoryChart } from "@/components/kpis/KpiHistoryChart";
import {
  InfoPanel,
  MetricCard,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import { getKPIById } from "@/services/kpis";
import { getKPIHistory } from "@/services/kpiHistory";
import { addKpiHistoryAction } from "./actions";

type KpiDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const kpi = await getKPIById(id).catch(() => null);
  return {
    title: kpi
      ? `${kpi.name} | KPI | Alwex One`
      : "KPI | Alwex One",
    description: "KPI-detalj med historik",
  };
}

function formatValue(value: string | null, unit: string | null): string {
  if (!value) {
    return "—";
  }
  return unit ? `${value} ${unit}` : value;
}

function toDateInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function KpiDetailPage({
  params,
  searchParams,
}: KpiDetailPageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const kpi = await getKPIById(id).catch(() => null);
  if (!kpi) {
    notFound();
  }

  const history = await getKPIHistory(kpi.id);
  const historyNewestFirst = [...history].reverse();
  const today = toDateInputValue(new Date().toISOString());

  const chartPoints = history.map((entry) => ({
    value: entry.value,
    status: entry.status,
    recordedAt: entry.recordedAt,
    label: formatDateSv(entry.recordedAt.slice(0, 10)),
  }));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="kpis" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <Link href="/admin/kpis" className="hover:text-neutral-800">
              KPI
            </Link>
            <span aria-hidden>/</span>
            <span className="text-neutral-800">{kpi.name}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                {kpi.name}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {kpi.businessAreaName}
                {kpi.category ? ` · ${kpi.category}` : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={kpi.status} />
              <Link
                href={`/admin/kpis?edit=${kpi.id}`}
                className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline"
              >
                Ändra KPI
              </Link>
            </div>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            name="Aktuellt värde"
            currentValue={formatValue(kpi.currentValue, kpi.unit)}
            targetValue={formatValue(kpi.targetValue, kpi.unit)}
            trend={kpi.trend}
            status={kpi.status}
          />
          <InfoPanel
            title="Översikt"
            variant="info"
            showLabel={false}
            footer={
              <>
                Senast uppdaterad
                <span className="mt-0.5 block text-sm font-medium text-slate-800">
                  {formatDateTimeSv(kpi.updatedAt)}
                </span>
              </>
            }
          >
            <dl className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Affärsområde</dt>
                <dd className="font-medium text-slate-800">
                  {kpi.businessAreaName}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Målvärde</dt>
                <dd className="font-medium text-slate-800">
                  {formatValue(kpi.targetValue, kpi.unit)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Trend</dt>
                <dd className="font-medium text-slate-800">{kpi.trend}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <StatusBadge status={kpi.status} />
                </dd>
              </div>
            </dl>
          </InfoPanel>
        </div>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
          <SectionHeader
            title="Värde över tid"
            description="Utfall och målvärde baserat på kpi_history"
          />
          <div className="mt-4">
            {history.length === 0 ? (
              <InfoPanel title="Historik" variant="info" showLabel={false}>
                Inga historiska värden registrerade ännu.
              </InfoPanel>
            ) : (
              <KpiHistoryChart
                points={chartPoints}
                targetValue={kpi.targetValue}
                unit={kpi.unit}
              />
            )}
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-neutral-200 px-5 py-4">
            <SectionHeader
              title="Historik"
              description={`${history.length} registrerade värden`}
            />
          </div>

          {historyNewestFirst.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">
              Ingen historik registrerad ännu.
            </p>
          ) : (
            <div className="overflow-x-auto px-5 py-4">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-600">
                    <th className="rounded-l-lg px-3 py-2.5 font-semibold">
                      Datum
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Värde</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="rounded-r-lg px-3 py-2.5 font-semibold">
                      Kommentar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historyNewestFirst.map((entry) => (
                    <tr key={entry.id}>
                      <td className="border-b border-neutral-100 px-3 py-3 text-neutral-700">
                        {formatDateTimeSv(entry.recordedAt)}
                      </td>
                      <td className="border-b border-neutral-100 px-3 py-3 font-medium text-neutral-900">
                        {formatValue(entry.value, kpi.unit)}
                      </td>
                      <td className="border-b border-neutral-100 px-3 py-3">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="border-b border-neutral-100 px-3 py-3 text-neutral-600">
                        {entry.comment || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <form
          action={addKpiHistoryAction}
          className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
        >
          <input type="hidden" name="kpiId" value={kpi.id} />
          <SectionHeader
            title="Registrera historikvärde"
            description="Lägg till ett nytt utfall i tidslinjen"
          />

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="value"
                className="block text-xs font-medium text-neutral-500"
              >
                Värde
              </label>
              <input
                id="value"
                name="value"
                type="text"
                required
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
                defaultValue={kpi.status}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              >
                <option value="Grön">Grön</option>
                <option value="Gul">Gul</option>
                <option value="Röd">Röd</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="recordedAt"
                className="block text-xs font-medium text-neutral-500"
              >
                Datum
              </label>
              <input
                id="recordedAt"
                name="recordedAt"
                type="date"
                required
                defaultValue={today}
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              />
            </div>

            <div>
              <label
                htmlFor="comment"
                className="block text-xs font-medium text-neutral-500"
              >
                Kommentar
              </label>
              <input
                id="comment"
                name="comment"
                type="text"
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Spara historikvärde
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
