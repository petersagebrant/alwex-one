import Link from "next/link";
import type { VdAttentionItem } from "@/services/vdAttention";

type VdAttentionListProps = {
  items: VdAttentionItem[];
  /** Daily VD queue is capped at 5. */
  maxItems?: number;
};

const toneDot: Record<string, string> = {
  red: "bg-rose-500",
  yellow: "bg-amber-400",
  slate: "bg-slate-400",
};

const toneBadge: Record<string, string> = {
  red: "border-rose-200/80 bg-rose-50 text-rose-800",
  yellow: "border-amber-200/80 bg-amber-50 text-amber-800",
  slate: "border-slate-200/80 bg-slate-50 text-slate-700",
};

export function VdAttentionList({
  items,
  maxItems = 5,
}: VdAttentionListProps) {
  const rows = (items ?? []).slice(0, maxItems);

  if (rows.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        Inget kräver VD:s uppmärksamhet just nu.
      </p>
    );
  }

  return (
    <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200/80 bg-white">
      {rows.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="group flex items-start gap-2.5 px-3 py-2 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300"
          >
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[item.statusTone] ?? toneDot.slate}`}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
                  {item.type}
                </span>
                <span
                  className={`inline-flex items-center rounded border px-1 py-px text-[10px] font-semibold leading-tight ${toneBadge[item.statusTone] ?? toneBadge.slate}`}
                >
                  {item.statusLabel}
                </span>
              </div>

              <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">
                {item.title}
              </p>
              <p className="text-xs leading-snug text-slate-500">{item.area}</p>

              {(item.metrics || item.trend) && (
                <p className="mt-0.5 text-xs leading-snug text-slate-700">
                  {item.metrics}
                  {item.metrics && item.trend ? " · " : null}
                  {item.trend ? `Trend: ${item.trend}` : null}
                </p>
              )}

              <p className="mt-0.5 text-xs leading-snug text-slate-600">
                {item.reason}
              </p>

              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                {item.owner ? `Ansvarig: ${item.owner}` : "Ansvarig saknas"}
              </p>
            </div>

            <span className="mt-0.5 shrink-0 self-start text-xs font-medium whitespace-nowrap text-slate-600 transition group-hover:text-slate-900">
              {item.linkLabel} ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
