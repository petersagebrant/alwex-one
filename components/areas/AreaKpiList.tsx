import type { KPI } from "@/types";
import { StatusPill } from "@/components/common/StatusPill";

type AreaKpiListProps = {
  kpis: KPI[];
};

function formatValue(value: string | null, unit: string | null): string {
  if (!value) {
    return "—";
  }
  return unit ? `${value} ${unit}` : value;
}

export function AreaKpiList({ kpis }: AreaKpiListProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">KPI</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Nyckeltal mot mål för affärsområdet
        </p>
      </div>

      {kpis.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">
          Inga KPI registrerade ännu.
        </p>
      ) : (
        <div className="overflow-x-auto px-5 py-4">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="bg-neutral-50 text-neutral-600">
                <th className="rounded-l-lg px-3 py-2.5 font-semibold">KPI</th>
                <th className="px-3 py-2.5 font-semibold">Utfall</th>
                <th className="px-3 py-2.5 font-semibold">Mål</th>
                <th className="px-3 py-2.5 font-semibold">Trend</th>
                <th className="rounded-r-lg px-3 py-2.5 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi) => (
                <tr key={kpi.id}>
                  <td className="border-b border-neutral-100 px-3 py-3 font-medium text-neutral-900">
                    {kpi.name}
                  </td>
                  <td className="border-b border-neutral-100 px-3 py-3 text-neutral-700">
                    {formatValue(kpi.currentValue, kpi.unit)}
                  </td>
                  <td className="border-b border-neutral-100 px-3 py-3 text-neutral-700">
                    {formatValue(kpi.targetValue, kpi.unit)}
                  </td>
                  <td className="border-b border-neutral-100 px-3 py-3 text-neutral-700">
                    {kpi.trend}
                  </td>
                  <td className="border-b border-neutral-100 px-3 py-3">
                    <StatusPill status={kpi.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
