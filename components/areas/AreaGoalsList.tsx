import Link from "next/link";
import type { Goal } from "@/types";
import { formatDateSv } from "@/lib/format/date";
import { GOAL_KIND_LABELS } from "@/lib/goals/kind";
import { GOAL_LIFECYCLE_LABELS } from "@/lib/goals/lifecycle";
import { StatusBadge } from "@/components/ui";

type AreaGoalsListProps = {
  goals: Goal[];
  canCreate?: boolean;
  newGoalHref?: string;
};

export function AreaGoalsList({
  goals,
  canCreate = false,
  newGoalHref,
}: AreaGoalsListProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Mål</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Målbild och uppföljning för affärsområdet
          </p>
        </div>
        {canCreate && newGoalHref ? (
          <Link
            href={newGoalHref}
            className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Nytt mål
          </Link>
        ) : null}
      </div>

      {goals.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">Inga mål ännu.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {goals.map((goal) => (
            <li key={goal.id}>
              <Link
                href={`/admin/goals/${goal.id}`}
                className="block cursor-pointer px-5 py-4 transition hover:bg-neutral-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">{goal.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {GOAL_KIND_LABELS[goal.goalKind]}
                      {goal.lifecycle === "DONE"
                        ? ` · ${GOAL_LIFECYCLE_LABELS.DONE}`
                        : null}
                      {` · ${goal.owner ?? "Ej angiven"}`}
                      {goal.deadline
                        ? ` · Deadline ${formatDateSv(goal.deadline)}`
                        : null}
                    </p>
                  </div>
                  <StatusBadge status={goal.status} />
                </div>
                {goal.goalKind === "MEASURABLE" ? (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-neutral-500">
                      <span>Progress</span>
                      <span>
                        {goal.progress === null || goal.progress === undefined
                          ? "—"
                          : `${goal.progress} %`}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-[#5b5bd6]"
                        style={{ width: `${goal.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
