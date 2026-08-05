import type { HistoryEvent } from "@/types";
import { formatDateSv } from "@/lib/format/date";

type AreaHistoryListProps = {
  events: HistoryEvent[];
};

export function AreaHistoryList({ events }: AreaHistoryListProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Historik</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Senaste händelser i affärsområdet
        </p>
      </div>

      {events.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">
          Ingen historik registrerad.
        </p>
      ) : (
        <ol className="relative space-y-0 px-5 py-2">
          {events.map((event, index) => (
            <li key={event.id} className="relative flex gap-4 py-4">
              <div className="flex w-4 flex-col items-center">
                <span
                  aria-hidden
                  className="mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#5b5bd6] bg-white"
                />
                {index < events.length - 1 ? (
                  <span
                    aria-hidden
                    className="mt-1 w-px flex-1 bg-neutral-200"
                  />
                ) : null}
              </div>
              <div className="min-w-0 pb-1">
                <p className="text-xs font-medium text-neutral-500">
                  {formatDateSv(event.date)}
                </p>
                <p className="mt-1 font-medium text-neutral-900">{event.title}</p>
                <p className="mt-0.5 text-sm text-neutral-600">{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
