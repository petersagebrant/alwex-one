import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { formatDateSv } from "@/lib/format/date";
import { getActivityById } from "@/services/activities";
import { getCommentsByActivityId } from "@/services/activityComments";
import { createActivityCommentAction } from "./actions";

type ActivityDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

const statusClass: Record<string, string> = {
  "Ej påbörjad": "bg-neutral-100 text-neutral-700",
  Pågår: "bg-indigo-50 text-indigo-700",
  Klar: "bg-emerald-50 text-emerald-700",
  Försenad: "bg-rose-50 text-rose-700",
};

const priorityClass: Record<string, string> = {
  Låg: "bg-neutral-100 text-neutral-700",
  Normal: "bg-amber-50 text-amber-800",
  Hög: "bg-rose-50 text-rose-700",
};

export async function generateMetadata({
  params,
}: ActivityDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const activity = await getActivityById(id).catch(() => null);

  return {
    title: activity
      ? `${activity.title} | LEIR`
      : "Aktivitet | LEIR",
  };
}

export default async function ActivityDetailPage({
  params,
  searchParams,
}: ActivityDetailPageProps) {
  const { id } = await params;
  const { error } = await searchParams;

  const activity = await getActivityById(id).catch(() => null);
  if (!activity) {
    notFound();
  }

  const comments = await getCommentsByActivityId(id);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="activities" />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <Link href="/admin/activities" className="hover:text-neutral-800">
            Aktiviteter
          </Link>
          <span aria-hidden>/</span>
          <span className="text-neutral-800">{activity.title}</span>
        </div>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
              {activity.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${priorityClass[activity.priority]}`}
              >
                {activity.priority}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusClass[activity.status]}`}
              >
                {activity.status}
              </span>
              <Link
                href={`/admin/activities?edit=${activity.id}`}
                className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline"
              >
                Ändra
              </Link>
            </div>
          </div>

          {activity.description ? (
            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              {activity.description}
            </p>
          ) : null}

          <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-neutral-100 pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-neutral-500">Affärsområde</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">
                {activity.businessAreaName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Kopplat mål</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">
                {activity.goalTitle ?? "Inget mål"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Ansvarig</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">
                {activity.owner ?? "Ej angiven"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Deadline</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">
                {activity.deadline
                  ? formatDateSv(activity.deadline)
                  : "Ej angiven"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-neutral-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">
              Kommentarer
            </h2>
          </div>

          {comments.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-500">
              Inga kommentarer ännu.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {comments.map((comment) => (
                <li key={comment.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">
                      {comment.authorName}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDateSv(comment.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                    {comment.content}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <form
            action={createActivityCommentAction}
            className="space-y-4 border-t border-neutral-200 px-5 py-5"
          >
            <input type="hidden" name="activityId" value={activity.id} />

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}

            <div>
              <label
                htmlFor="authorName"
                className="block text-xs font-medium text-neutral-500"
              >
                Författare
              </label>
              <input
                id="authorName"
                name="authorName"
                type="text"
                required
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              />
            </div>

            <div>
              <label
                htmlFor="content"
                className="block text-xs font-medium text-neutral-500"
              >
                Kommentar
              </label>
              <textarea
                id="content"
                name="content"
                rows={3}
                required
                className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Lägg till kommentar
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
