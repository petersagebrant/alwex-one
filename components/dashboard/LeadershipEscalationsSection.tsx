import { LeadershipEscalationReply } from "@/components/dashboard/LeadershipEscalationReply";
import { InfoPanel } from "@/components/ui";
import { formatDateTimeSv } from "@/lib/format/date";
import type { LeadershipEscalationItem } from "@/types/activity-escalation";

type LeadershipEscalationsSectionProps = {
  items: LeadershipEscalationItem[];
};

export function LeadershipEscalationsSection({
  items,
}: LeadershipEscalationsSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <InfoPanel
      title="Från Daglig styrning – kräver ditt beslut"
      variant="info"
      showLabel={false}
      compact
      className="!border-slate-200/80 !bg-white"
    >
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 border-l-4 border-l-amber-500 bg-amber-50/60 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200/80">
                  Från Daglig styrning
                </span>
                <span className="text-sm text-slate-600">
                  {item.businessAreaName}
                </span>
              </div>
              <p className="mt-1 font-medium text-slate-900">
                {item.activityTitle}
              </p>
              <p className="mt-0.5 text-sm text-slate-800">{item.question}</p>
              <p className="mt-0.5 text-sm text-slate-600">
                {item.askedByName ? `${item.askedByName} · ` : ""}
                {formatDateTimeSv(item.askedAt)}
              </p>
            </div>
            <LeadershipEscalationReply escalationId={item.id} />
          </li>
        ))}
      </ul>
    </InfoPanel>
  );
}
