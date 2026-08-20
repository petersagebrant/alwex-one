import Link from "next/link";
import type { BusinessAreaSummary } from "@/types";
import { formatDateSv } from "@/lib/format/date";
import { AreaOperationalStatusBadge } from "@/components/areas/AreaOperationalStatusBadge";

type AreaCardProps = {
  area: BusinessAreaSummary;
};

export function AreaCard({ area }: AreaCardProps) {
  return (
    <Link
      href={`/areas/${area.slug}`}
      className="group flex h-full flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition duration-150 hover:border-neutral-300 hover:shadow-[0_8px_24px_rgba(16,24,40,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b5bd6]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900 group-hover:text-[#4f46e5]">
          {area.name}
        </h2>
        <AreaOperationalStatusBadge status={area.status} variant="pill" />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-500">Ansvarig</dt>
          <dd className="mt-0.5 font-medium text-neutral-800">{area.manager}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Senast uppdaterad</dt>
          <dd className="mt-0.5 font-medium text-neutral-800">
            {formatDateSv(area.updatedAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Mål</dt>
          <dd className="mt-0.5 font-medium text-neutral-800">
            {area.goalCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Aktiviteter</dt>
          <dd className="mt-0.5 font-medium text-neutral-800">
            {area.activityCount}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4 text-sm">
        <span className="text-neutral-500">Öppna affärsområde</span>
        <span
          aria-hidden
          className="text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-[#4f46e5]"
        >
          →
        </span>
      </div>
    </Link>
  );
}
