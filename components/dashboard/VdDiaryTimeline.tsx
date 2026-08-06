import Link from "next/link";
import type { VdDiaryEvent, VdDiaryTone } from "@/data/mock/vd-diary";

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
    <ol className="relative space-y-0">
      {(items ?? []).map((event, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className="absolute top-3 left-[9px] h-[calc(100%-4px)] w-px bg-slate-200"
              />
            ) : null}

            <span
              aria-hidden
              className={`relative z-10 mt-1.5 h-[18px] w-[18px] shrink-0 rounded-full ring-4 ring-white ${toneDotClass[event.tone]}`}
              title={toneEmoji[event.tone]}
            />

            <div className="min-w-0 flex-1 rounded-xl border border-slate-200/70 bg-white/90 px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    <span aria-hidden className="mr-1.5">
                      {toneEmoji[event.tone]}
                    </span>
                    {event.headline}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-slate-800">
                    {event.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {event.area}
                    <span className="mx-1.5 text-slate-300" aria-hidden>
                      ·
                    </span>
                    {event.owner}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {event.occurredAtLabel}
                  </p>
                </div>

                <Link
                  href={event.href}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#0b1220] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  Öppna
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
