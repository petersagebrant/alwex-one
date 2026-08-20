import Link from "next/link";
import type { BusinessArea } from "@/types";
import { formatDateSv } from "@/lib/format/date";
import { AreaOperationalStatusBadge } from "@/components/areas/AreaOperationalStatusBadge";
import type { AreaOperationalStatus } from "@/lib/kpi/areaOperationalStatus";

type AreaDetailHeaderProps = {
  area: Omit<BusinessArea, "status"> & { status: AreaOperationalStatus };
};

export function AreaDetailHeader({ area }: AreaDetailHeaderProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <Link href="/areas" className="hover:text-neutral-800">
          Affärsområden
        </Link>
        <span aria-hidden>/</span>
        <span className="text-neutral-800">{area.name}</span>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              {area.name}
            </h1>
            <AreaOperationalStatusBadge status={area.status} variant="pill" />
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-[15px]">
            {area.description}
          </p>
        </div>

        <dl className="shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
          <div>
            <dt className="text-xs text-neutral-500">Ansvarig</dt>
            <dd className="mt-0.5 font-medium text-neutral-900">
              {area.manager}
            </dd>
          </div>
          <div className="mt-3">
            <dt className="text-xs text-neutral-500">Senast uppdaterad</dt>
            <dd className="mt-0.5 font-medium text-neutral-900">
              {formatDateSv(area.updatedAt)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
