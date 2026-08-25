import type { Metadata } from "next";
import Link from "next/link";
import { AreaNoticeArchiveControls } from "@/components/admin/AreaNoticeArchiveControls";
import { AreaNoticeFormFields } from "@/components/admin/AreaNoticeFormFields";
import { AreaNoticeKindBadge } from "@/components/notices/AreaNoticeKindBadge";
import { AppHeader } from "@/components/layout/AppHeader";
import { requireProfile } from "@/lib/auth/require-user";
import { formatDateSv } from "@/lib/format/date";
import { canWriteAreaNotices } from "@/lib/notices/permissions";
import {
  isArchivedAreaNotice,
  isCurrentAreaNotice,
  isExpiredAreaNotice,
} from "@/lib/notices/visibility";
import {
  createAreaNoticeAction,
  updateAreaNoticeAction,
} from "./actions";
import {
  getAreaNoticeById,
  getAreaNotices,
  getOperationalAreaNoticeOptions,
  type AreaNoticeListItem,
} from "@/services/areaNotices";

export const metadata: Metadata = {
  title: "Administrera Aktuellt | LEIR",
  description: "Lista, skapa och uppdatera Aktuellt-inlägg",
};

type AdminAktuelltPageProps = {
  searchParams: Promise<{
    new?: string;
    edit?: string;
    area?: string;
    error?: string;
  }>;
};

export default async function AdminAktuelltPage({
  searchParams,
}: AdminAktuelltPageProps) {
  const params = await searchParams;
  const profile = await requireProfile();
  const canWrite = canWriteAreaNotices(profile.role);
  const requestedCreate = params.new === "1";
  const editId = params.edit?.trim() || null;
  const lockedAreaFromQuery = params.area?.trim() || null;
  const error = params.error;
  const showCreate = canWrite && requestedCreate;
  const showEditRequest = canWrite && Boolean(editId);
  const aoChefLockedArea =
    profile.role === "ao_chef" ? profile.businessAreaId : null;

  const [notices, areas, editingNotice] = await Promise.all([
    getAreaNotices({ includeArchived: canWrite }),
    getOperationalAreaNoticeOptions(),
    showEditRequest && editId
      ? getAreaNoticeById(editId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const currentNotices = notices.filter((notice) => isCurrentAreaNotice(notice));
  const expiredNotices = notices.filter((notice) => isExpiredAreaNotice(notice));
  const archivedNotices = notices.filter((notice) =>
    isArchivedAreaNotice(notice),
  );
  const showEdit = Boolean(showEditRequest && editingNotice);
  const lockedAreaId =
    aoChefLockedArea ||
    (lockedAreaFromQuery &&
    areas.some((area) => area.id === lockedAreaFromQuery)
      ? lockedAreaFromQuery
      : null);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="areas" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <Link href="/areas" className="hover:text-neutral-800">
                Affärsområden
              </Link>
              <span aria-hidden>/</span>
              <span className="text-neutral-800">Aktuellt</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
              Administrera Aktuellt
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {currentNotices.length} aktuella
              {canWrite && expiredNotices.length > 0
                ? ` · ${expiredNotices.length} utgångna`
                : null}
              {canWrite && archivedNotices.length > 0
                ? ` · ${archivedNotices.length} arkiverade`
                : null}
            </p>
          </div>

          {canWrite && !showCreate && !showEdit ? (
            <Link
              href="/admin/aktuellt?new=1"
              className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Nytt inlägg
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
            action={createAreaNoticeAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <h2 className="text-sm font-semibold text-neutral-900">
              Nytt inlägg
            </h2>
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <AreaNoticeFormFields
                areas={areas}
                lockedAreaId={lockedAreaId}
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
                href="/admin/aktuellt"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {showEdit && editingNotice ? (
          <form
            action={updateAreaNoticeAction}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
          >
            <input type="hidden" name="id" value={editingNotice.id} />
            <h2 className="text-sm font-semibold text-neutral-900">
              Ändra inlägg
            </h2>
            {isArchivedAreaNotice(editingNotice) ? (
              <p className="mt-2 text-sm text-amber-800">
                Detta inlägg är arkiverat. Återaktivera för att visa det på
                Aktuellt igen.
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="mt-4 space-y-4">
              <AreaNoticeFormFields
                areas={areas}
                notice={editingNotice}
                lockedAreaId={aoChefLockedArea}
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
                href="/admin/aktuellt"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Avbryt
              </Link>
            </div>
          </form>
        ) : null}

        {editId && canWrite && !editingNotice ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            Inlägget hittades inte.
          </p>
        ) : null}

        <NoticeAdminListSection
          title="Aktuella inlägg"
          notices={currentNotices}
          canWrite={canWrite}
          emptyText="Inga aktuella inlägg."
        />

        {canWrite && expiredNotices.length > 0 ? (
          <NoticeAdminListSection
            title="Utgångna inlägg"
            notices={expiredNotices}
            canWrite={canWrite}
            emptyText="Inga utgångna inlägg."
          />
        ) : null}

        {canWrite && archivedNotices.length > 0 ? (
          <NoticeAdminListSection
            title="Arkiverade inlägg"
            notices={archivedNotices}
            canWrite={canWrite}
            emptyText="Inga arkiverade inlägg."
          />
        ) : null}
      </main>
    </div>
  );
}

function NoticeAdminListSection({
  title,
  notices,
  canWrite,
  emptyText,
}: {
  title: string;
  notices: AreaNoticeListItem[];
  canWrite: boolean;
  emptyText: string;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      </div>

      {notices.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {notices.map((notice) => {
            const archived = isArchivedAreaNotice(notice);
            return (
              <li key={notice.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AreaNoticeKindBadge kind={notice.kind} />
                      <p className="font-medium text-neutral-900">
                        {notice.title}
                        {archived ? (
                          <span className="ml-2 text-xs font-semibold text-neutral-500">
                            Arkiverad
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {notice.businessAreaName}
                      {notice.endsOn
                        ? ` · Gäller till ${formatDateSv(notice.endsOn)}`
                        : null}
                    </p>
                    <p className="mt-2 text-sm text-neutral-700">{notice.body}</p>
                  </div>
                  {canWrite ? (
                    <div className="flex flex-col items-end gap-2">
                      <Link
                        href={`/admin/aktuellt?edit=${notice.id}`}
                        className="text-xs font-medium text-neutral-600 underline-offset-2 hover:underline"
                      >
                        Ändra
                      </Link>
                      <AreaNoticeArchiveControls
                        noticeId={notice.id}
                        noticeTitle={notice.title}
                        businessAreaName={notice.businessAreaName}
                        archived={archived}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
