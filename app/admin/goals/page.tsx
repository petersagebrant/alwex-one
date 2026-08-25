import type { Metadata } from "next";
import Link from "next/link";
import { GoalArchiveControls } from "@/components/admin/GoalArchiveControls";
import { GoalFormFields } from "@/components/admin/GoalFormFields";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatusBadge } from "@/components/ui";
import { requireProfile } from "@/lib/auth/require-user";
import { formatDateSv } from "@/lib/format/date";
import { isGoalArchived } from "@/lib/goals/archive";
import { GOAL_KIND_LABELS } from "@/lib/goals/kind";
import { GOAL_LIFECYCLE_LABELS } from "@/lib/goals/lifecycle";
import { toGoalOwnerOptions } from "@/lib/goals/owner";
import { canWriteGoals } from "@/lib/goals/permissions";
import { getBusinessAreaOptions } from "@/services/businessAreas";
import { getGoalById, getGoals } from "@/services/goals";
import type { GoalListItem } from "@/services/goals";
import { fetchActiveProfilesForAssignment } from "@/lib/supabase/profiles";
import { createGoalAction, updateGoalAction } from "./actions";

export const metadata: Metadata = {
  title: "Administrera mål | LEIR",
  description: "Lista, skapa och uppdatera mål",
};

type AdminGoalsPageProps = {
  searchParams: Promise<{
    new?: string;
    edit?: string;
    area?: string;
    error?: string;
  }>;
};

export default async function AdminGoalsPage({
  searchParams,
}: AdminGoalsPageProps) {
  const params = await searchParams;
  const profile = await requireProfile();
  const canWrite = canWriteGoals(profile.role);
  const requestedCreate = params.new === "1";
  const editId = params.edit?.trim() || null;
  const lockedAreaId = params.area?.trim() || null;
  const error = params.error;
  const showCreate = canWrite && requestedCreate;
  const showEditRequest = canWrite && Boolean(editId);

  const [goals, areas, owners, editingGoal] = await Promise.all([
    getGoals({ includeArchived: canWrite }),
    getBusinessAreaOptions(),
    fetchActiveProfilesForAssignment().then(toGoalOwnerOptions),
    showEditRequest && editId
      ? getGoalById(editId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const activeGoals = goals.filter((goal) => !isGoalArchived(goal));
  const archivedGoals = goals.filter((goal) => isGoalArchived(goal));
  const showEdit = Boolean(showEditRequest && editingGoal);
  const lockedArea =
    lockedAreaId && areas.some((area) => area.id === lockedAreaId)
      ? lockedAreaId
      : null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="goals" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <Link href="/areas" className="hover:text-neutral-800">
                Affärsområden
              </Link>
              <span aria-hidden>/</span>
              <span className="text-neutral-800">Mål</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
              Administrera mål
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {activeGoals.length} aktiva
              {canWrite && archivedGoals.length > 0
                ? ` · ${archivedGoals.length} arkiverade`
                : null}
            </p>
          </div>

          {canWrite && !showCreate && !showEdit ? (
            <Link
              href="/admin/goals?new=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Nytt mål
            </Link>
          ) : null}
        </div>

        {error && !showCreate && !showEdit ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        {showCreate ? (
          <form
            action={createGoalAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <h2 className="text-sm font-semibold text-neutral-900">Nytt mål</h2>
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <GoalFormFields
                areas={areas}
                owners={owners}
                lockedAreaId={lockedArea}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara
              </button>
              <Link
                href="/admin/goals"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {showEdit && editingGoal ? (
          <form
            action={updateGoalAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <input type="hidden" name="id" value={editingGoal.id} />
            <h2 className="text-sm font-semibold text-neutral-900">Ändra mål</h2>
            {isGoalArchived(editingGoal) ? (
              <p className="mt-2 text-sm text-amber-800">
                Detta mål är arkiverat. Historik behålls; återaktivera för att
                visa det i aktiva listor igen.
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <GoalFormFields
                areas={areas}
                owners={owners}
                goal={editingGoal}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Spara ändringar
              </button>
              <Link
                href={`/admin/goals/${editingGoal.id}`}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {editId && canWrite && !editingGoal ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Målet hittades inte.
          </p>
        ) : null}

        <GoalAdminListSection
          title="Aktiva mål"
          goals={activeGoals}
          canWrite={canWrite}
          emptyText="Inga mål ännu."
        />

        {canWrite && archivedGoals.length > 0 ? (
          <GoalAdminListSection
            title="Arkiverade mål"
            goals={archivedGoals}
            canWrite={canWrite}
            emptyText="Inga arkiverade mål."
          />
        ) : null}
      </main>
    </div>
  );
}

function GoalAdminListSection({
  title,
  goals,
  canWrite,
  emptyText,
}: {
  title: string;
  goals: GoalListItem[];
  canWrite: boolean;
  emptyText: string;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      </div>

      {goals.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {goals.map((goal) => {
            const archived = isGoalArchived(goal);
            return (
              <li key={goal.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link
                    href={`/admin/goals/${goal.id}`}
                    className="min-w-0 flex-1 cursor-pointer transition hover:opacity-90"
                  >
                    <p className="font-medium text-neutral-900">
                      {goal.title}
                      {archived ? (
                        <span className="ml-2 text-xs font-semibold text-neutral-500">
                          Arkiverad
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {GOAL_KIND_LABELS[goal.goalKind]}
                      {` · ${GOAL_LIFECYCLE_LABELS[goal.lifecycle]}`}
                      {` · ${goal.businessAreaName}`}
                      {goal.owner ? ` · ${goal.owner}` : null}
                      {goal.deadline
                        ? ` · Deadline ${formatDateSv(goal.deadline)}`
                        : null}
                      {goal.targetValue
                        ? ` · Målvärde ${goal.targetValue}`
                        : null}
                    </p>
                  </Link>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={goal.status} />
                    {canWrite ? (
                      <GoalArchiveControls
                        goalId={goal.id}
                        goalTitle={goal.title}
                        businessAreaName={goal.businessAreaName}
                        archived={archived}
                      />
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
