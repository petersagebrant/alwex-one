import type { Kpi } from "@/types";
import { StatusPill } from "@/components/common/StatusPill";

type AreaKpiListProps = {
  kpis: Kpi[];
};

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
        <p className="px-5 py-8 text-sm text-neutral-500">Inga KPI:er registrerade.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-px bg-neutral-100 sm:grid-cols-2">
          {kpis.map((kpi) => (
            <li key={kpi.id} className="bg-white px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-neutral-500">{kpi.label}</p>
                <StatusPill status={kpi.status} />
              </div>
              <p className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
                {kpi.value}
              </p>
              <p className="mt-1 text-xs text-neutral-500">Mål: {kpi.target}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
