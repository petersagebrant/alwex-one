import type { Activity } from "@/types";
import Link from "next/link";
import { formatDateSv } from "@/lib/format/date";

type AreaActivitiesListProps = {
  activities: Activity[];
};

const activityStatusClass: Record<Activity["status"], string> = {
  "Ej påbörjad": "bg-neutral-100 text-neutral-700",
  Pågår: "bg-indigo-50 text-indigo-700",
  Klar: "bg-emerald-50 text-emerald-700",
  Försenad: "bg-rose-50 text-rose-700",
};

const priorityClass: Record<Activity["priority"], string> = {
  Låg: "bg-neutral-100 text-neutral-700",
  Normal: "bg-amber-50 text-amber-800",
  Hög: "bg-rose-50 text-rose-700",
};

export function AreaActivitiesList({ activities }: AreaActivitiesListProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Aktiviteter</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Pågående och planerade åtgärder
        </p>
      </div>

      {activities.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">
          Inga aktiviteter ännu.
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
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${priorityClass[activity.priority]}`}
                  >
                    {activity.priority}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${activityStatusClass[activity.status]}`}
                  >
                    {activity.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
