import Link from "next/link";
import type { VdDiaryEvent, VdDiaryTone } from "@/types";

const toneDotClass: Record<VdDiaryTone, string> = {
  yellow: "bg-amber-400",
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  red: "bg-rose-500",
  slate: "bg-slate-400",
};

const toneEmoji: Record<VdDiaryTone, string> = {
  yellow: "🟡",
  green: "🟢",
  blue: "🔵",
  red: "🔴",
  slate: "⚪",
};

type VdDiaryTimelineProps = {
  events: VdDiaryEvent[];
};

export function VdDiaryTimeline({ events }: VdDiaryTimelineProps) {
  const items = events ?? [];

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Inga händelser registrerade ännu.
      </p>
    );
  }

  return (
    <ul className="-mx-4 sm:-mx-4">
      {items.map((event) => (
        <li key={event.id} className="border-b border-slate-100 last:border-b-0">
          <Link
            href={event.href || "/"}
            className="grid h-16 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 transition hover:bg-slate-50"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneDotClass[event.tone] ?? toneDotClass.slate}`}
                title={toneEmoji[event.tone] ?? toneEmoji.slate}
              />

              <div className="min-w-0 leading-tight">
                <p className="truncate text-[11px] font-medium text-slate-500">
                  <span aria-hidden className="mr-1">
                    {toneEmoji[event.tone] ?? toneEmoji.slate}
                  </span>
                  {event.headline}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                  {event.title}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {event.area}
                  <span className="mx-1.5 text-slate-300" aria-hidden>
                    •
                  </span>
                  {event.owner}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <time className="whitespace-nowrap text-right text-xs text-slate-500">
                {event.occurredAtLabel}
              </time>
              <span aria-hidden className="text-slate-300">
                ›
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
