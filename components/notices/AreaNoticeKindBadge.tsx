import type { AreaNoticeKind } from "@/types/area-notice";
import { AREA_NOTICE_KIND_LABELS } from "@/lib/notices/kind";

const kindClass: Record<AreaNoticeKind, string> = {
  Driftstörning: "bg-rose-50 text-rose-800 ring-rose-200/80",
  Viktigt: "bg-amber-50 text-amber-900 ring-amber-200/80",
  Behov: "bg-sky-50 text-sky-800 ring-sky-200/80",
  Information: "bg-slate-50 text-slate-700 ring-slate-200/80",
};

const kindDot: Record<AreaNoticeKind, string> = {
  Driftstörning: "bg-rose-500",
  Viktigt: "bg-amber-400",
  Behov: "bg-sky-500",
  Information: "bg-slate-400",
};

export function AreaNoticeKindBadge({ kind }: { kind: AreaNoticeKind }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${kindClass[kind]}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${kindDot[kind]}`}
      />
      {AREA_NOTICE_KIND_LABELS[kind]}
    </span>
  );
}
