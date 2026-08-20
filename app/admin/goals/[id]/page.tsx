import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  InfoPanel,
  SectionHeader,
  StatusBadge,
  SummaryCard,
} from "@/components/ui";
import { formatDateSv, formatDateTimeSv } from "@/lib/format/date";
import { getGoalById } from "@/services/goals";

type GoalDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const goal = await getGoalById(id).catch(() => null);
  return {
    title: goal ? `${goal.title} | Mål | LEIR` : "Mål | LEIR",
    description: "Måldetalj",
  };
}

export default async function GoalDetailPage({ params }: GoalDetailPageProps) {
  const { id } = await params;
  const goal = await getGoalById(id).catch(() => null);

  if (!goal) {
    notFound();
  }

  const progressLabel =
    goal.progress === null || goal.progress === undefined
      ? "—"
      : `${goal.progress} %`;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="goals" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <Link href="/admin/goals" className="hover:text-neutral-800">
              Mål
            </Link>
            <span aria-hidden>/</span>
            <span className="text-neutral-800">{goal.title}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
                {goal.title}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {goal.businessAreaName}
                {goal.owner ? ` · ${goal.owner}` : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={goal.status} />
              <Link
                href={`/admin/goals?edit=${goal.id}`}
                className="text-sm font-medium text-neutral-700 underline-offset-4 hover:underline"
              >
                Ändra mål
              </Link>
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <SectionHeader title="Översikt" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Aktuellt värde"
              value={goal.currentValue ?? "—"}
            />
            <SummaryCard title="Målvärde" value={goal.targetValue ?? "—"} />
            <SummaryCard title="Progress" value={progressLabel} />
            <SummaryCard
              title="Deadline"
              value={goal.deadline ? formatDateSv(goal.deadline) : "—"}
            />
          </div>
        </section>

        <InfoPanel title="Detaljer" variant="info" showLabel={false}>
          <dl className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Namn</dt>
              <dd className="font-medium text-slate-800">{goal.title}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Affärsområde</dt>
              <dd className="font-medium text-slate-800">
                {goal.businessAreaName}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Ansvarig</dt>
              <dd className="font-medium text-slate-800">
                {goal.owner ?? "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Status</dt>
              <dd>
                <StatusBadge status={goal.status} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Skapad</dt>
              <dd className="font-medium text-slate-800">
                {formatDateTimeSv(goal.createdAt)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-slate-500">Uppdaterad</dt>
              <dd className="font-medium text-slate-800">
                {formatDateTimeSv(goal.updatedAt)}
              </dd>
            </div>
          </dl>
        </InfoPanel>

        <InfoPanel title="Beskrivning" variant="vd-comment" showLabel={false}>
          {goal.description?.trim()
            ? goal.description
            : "Ingen beskrivning registrerad ännu."}
        </InfoPanel>
      </main>
    </div>
  );
}
