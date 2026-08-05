import type { Goal } from "@/types";
import { formatDateSv } from "@/lib/format/date";
import { StatusPill } from "@/components/common/StatusPill";

type AreaGoalsListProps = {
  goals: Goal[];
};

export function AreaGoalsList({ goals }: AreaGoalsListProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Mål</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Målbild och uppföljning för affärsområdet
        </p>
      </div>

      {goals.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">
          Inga mål ännu.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {goals.map((goal) => (
            <li key={goal.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{goal.title}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {goal.owner ?? "Ej angiven"}
                    {goal.deadline
                      ? ` · Deadline ${formatDateSv(goal.deadline)}`
                      : null}
                  </p>
                </div>
                <StatusPill status={goal.status} />
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-neutral-500">
                  <span>Progress</span>
                  <span>{goal.progress ?? 0} %</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-[#5b5bd6]"
                    style={{ width: `${goal.progress ?? 0}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
