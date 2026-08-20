import Link from "next/link";
import type { VdDiaryEvent, VdDiaryTone } from "@/types";

const toneDotClass: Record<VdDiaryTone, string> = {
  yellow: "bg-amber-400",
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  red: "bg-rose-500",
  slate: "bg-slate-400",
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
    <ul className="divide-y divide-slate-100">
      {items.map((event) => {
        const body = (
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${toneDotClass[event.tone] ?? toneDotClass.slate}`}
            />
            <div className="min-w-0 flex-1 leading-snug">
              <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                {event.headline}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {event.title}
              </p>
              {event.changeSummary ? (
                <p className="mt-0.5 text-sm text-slate-700">
                  {event.changeSummary}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                {event.area}
                {event.owner && event.owner !== "—" ? (
                  <>
                    <span className="mx-1.5 text-slate-300" aria-hidden>
                      ·
                    </span>
                    {event.owner}
                  </>
                ) : null}
                <span className="mx-1.5 text-slate-300" aria-hidden>
                  ·
                </span>
                <time dateTime={event.occurredAt}>{event.occurredAtLabel}</time>
              </p>
            </div>
            {event.href ? (
              <span
                aria-hidden
                className="mt-0.5 shrink-0 text-base leading-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
              >
                ›
              </span>
            ) : null}
          </div>
        );

        return (
          <li key={event.id} className="py-3 first:pt-0 last:pb-0">
            {event.href ? (
              <Link
                href={event.href}
                className="group block rounded-lg outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
