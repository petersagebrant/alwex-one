import Link from "next/link";
import { AreaNoticeArchiveControls } from "@/components/admin/AreaNoticeArchiveControls";
import { AreaNoticeKindBadge } from "@/components/notices/AreaNoticeKindBadge";
import { formatDateSv } from "@/lib/format/date";
import type { AreaNoticeListItem } from "@/services/areaNotices";

type AreaNoticesListProps = {
  notices: AreaNoticeListItem[];
  canWrite?: boolean;
  newNoticeHref?: string;
  manageHref?: string;
};

export function AreaNoticesList({
  notices,
  canWrite = false,
  newNoticeHref,
  manageHref,
}: AreaNoticesListProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Aktuellt</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Information, behov och driftstörningar för affärsområdet
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            {manageHref ? (
              <Link
                href={manageHref}
                className="text-sm font-medium text-neutral-600 underline-offset-4 hover:underline"
              >
                Hantera
              </Link>
            ) : null}
            {newNoticeHref ? (
              <Link
                href={newNoticeHref}
                className="inline-flex items-center justify-center rounded-xl bg-[#111827] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
              >
                Nytt inlägg
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {notices.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">
          Inget aktuellt just nu.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {notices.map((notice) => (
            <li key={notice.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AreaNoticeKindBadge kind={notice.kind} />
                    <p className="font-medium text-neutral-900">{notice.title}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                    {notice.body}
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    {notice.createdByName || "Okänd"}
                    {notice.endsOn
                      ? ` · Gäller till ${formatDateSv(notice.endsOn)}`
                      : null}
                  </p>
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
                      archived={Boolean(notice.archivedAt)}
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
