import Link from "next/link";
import { AreaNoticeKindBadge } from "@/components/notices/AreaNoticeKindBadge";
import { InfoPanel } from "@/components/ui";
import { truncateNoticeBody } from "@/lib/notices/rank";
import type { AreaNoticeKind } from "@/types/area-notice";
import type { AreaNoticeListItem } from "@/services/areaNotices";

type OrgNoticesFeedProps = {
  notices: AreaNoticeListItem[];
};

/**
 * Dashboard-only item tones (left accent + light tint).
 * Behov uses muted teal so it stays distinct from Driftstörning (rose/red),
 * Viktigt (amber), Information (sky/blue), and GYR emerald.
 */
const noticeItemTone: Record<AreaNoticeKind, string> = {
  Driftstörning: "border-l-rose-500 bg-rose-50/55",
  Viktigt: "border-l-amber-400 bg-amber-50/55",
  Information: "border-l-sky-500 bg-sky-50/50",
  Behov: "border-l-teal-600 bg-teal-50/55",
};

export function OrgNoticesFeed({ notices }: OrgNoticesFeedProps) {
  return (
    <InfoPanel
      title="Aktuellt i verksamheten"
      showLabel={false}
      className="!border-2 !border-slate-300 !bg-white !shadow-[0_10px_28px_rgba(15,23,42,0.08)]"
    >
      {notices.length === 0 ? (
        <p className="text-sm text-slate-600">Inget aktuellt just nu.</p>
      ) : (
        <ul className="space-y-2.5">
          {notices.map((notice) => {
            const href = notice.businessAreaSlug
              ? `/areas/${notice.businessAreaSlug}`
              : "/areas";
            return (
              <li
                key={notice.id}
                className={`rounded-xl border border-slate-200/70 border-l-4 px-3.5 py-3 ${noticeItemTone[notice.kind]}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AreaNoticeKindBadge kind={notice.kind} />
                      <p className="text-sm font-semibold text-slate-900">
                        {notice.businessAreaName}
                      </p>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {notice.title}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {truncateNoticeBody(notice.body)}
                    </p>
                  </div>
                  <Link
                    href={href}
                    className="shrink-0 text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
                  >
                    Se alla
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </InfoPanel>
  );
}
