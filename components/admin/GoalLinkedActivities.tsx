import Link from "next/link";
import type { Activity } from "@/types";
import { formatDateSv } from "@/lib/format/date";

const activityStatusClass: Record<Activity["status"], string> = {
  "Ej påbörjad": "bg-neutral-100 text-neutral-700",
  Pågår: "bg-indigo-50 text-indigo-700",
  Klar: "bg-emerald-50 text-emerald-700",
  Försenad: "bg-rose-50 text-rose-700",
};

type GoalLinkedActivitiesProps = {
  goalId: string;
  activities: Activity[];
  canCreate?: boolean;
};

export function GoalLinkedActivities({
  goalId,
  activities,
  canCreate = false,
}: GoalLinkedActivitiesProps) {
  const newHref = `/admin/activities?new=1&goalId=${encodeURIComponent(goalId)}`;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            Kopplade aktiviteter
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Aktiviteter med detta mål som goal_id
          </p>
        </div>
        {canCreate ? (
          <Link
            href={newHref}
            className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Ny aktivitet
          </Link>
        ) : null}
      </div>

      {activities.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">
          Inga kopplade aktiviteter ännu.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {activities.map((activity) => (
            <li key={activity.id}>
              <Link
                href={`/activities/${activity.id}`}
                className="flex flex-col gap-3 px-5 py-4 transition hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">
                    {activity.title}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {activity.owner ?? "Ej angiven"}
                    {activity.deadline
                      ? ` · Deadline ${formatDateSv(activity.deadline)}`
                      : null}
                  </p>
                </div>
                <span
                  className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${activityStatusClass[activity.status]}`}
                >
                  {activity.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
