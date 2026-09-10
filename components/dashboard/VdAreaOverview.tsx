import Link from "next/link";
import { AreaOperationalStatusBadge } from "@/components/areas/AreaOperationalStatusBadge";
import { SectionHeader } from "@/components/ui";
import type { VdAreaOverviewRow } from "@/lib/kpi/vdAreaOverview";
import { AREA_STATUS_UNREPORTED } from "@/lib/kpi/areaOperationalStatus";

type VdAreaOverviewProps = {
  rows: VdAreaOverviewRow[];
};

/**
 * Compact VD scan of operational areas. Full KPI/history stay on /areas/{slug}.
 */
export function VdAreaOverview({ rows }: VdAreaOverviewProps) {
  return (
    <section aria-label="Affärsområden" className="space-y-3">
      <SectionHeader
        title="Affärsområden"
        description="Status och viktigaste avvikelse. Öppna området för alla KPI:er och historik."
        className="scroll-mt-6"
        action={
          <Link
            href="/areas"
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            Alla affärsområden
          </Link>
        }
      />

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">Inga affärsområden att visa.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={row.href}
                className="group flex items-center gap-3 px-3 py-2.5 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300 md:grid md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.4fr)_minmax(0,0.8fr)] md:items-center md:gap-4 md:px-4 md:py-3"
              >
                <div className="min-w-0 flex-1 md:flex-none">
                  <p className="sr-only">Affärsområde</p>
                  <p className="truncate font-semibold text-slate-900">
                    {row.name}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-600 md:hidden">
                    {row.keyDeviation}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {row.status == null ? (
                    <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200/80">
                      {AREA_STATUS_UNREPORTED}
                    </span>
                  ) : (
                    <AreaOperationalStatusBadge status={row.status} />
                  )}
                </div>

                <div className="hidden min-w-0 md:block">
                  <p className="sr-only">Avvikelse</p>
                  <p className="truncate text-sm text-slate-700">
                    {row.keyDeviation}
                  </p>
                </div>

                <div className="hidden min-w-0 items-center justify-end gap-3 md:flex">
                  <div className="min-w-0">
                    <p className="sr-only">Ansvarig</p>
                    <p className="truncate text-sm text-slate-600">
                      {row.manager}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="shrink-0 text-base leading-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
                  >
                    ›
                  </span>
                </div>

                <span
                  aria-hidden
                  className="shrink-0 text-base leading-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 md:hidden"
                >
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
