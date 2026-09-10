import { formatDateTimeSv } from "@/lib/format/date";
import { sortEscalationHistory } from "@/lib/operational-reports/escalation";
import type { ActivityEscalation } from "@/types/activity-escalation";

type ActivityEscalationHistoryProps = {
  escalations: ActivityEscalation[];
};

export function ActivityEscalationHistory({
  escalations,
}: ActivityEscalationHistoryProps) {
  if (escalations.length === 0) {
    return null;
  }

  return (
    <div className="mt-0.5 space-y-1.5">
      {sortEscalationHistory(escalations).map((item) => (
        <div key={item.id} className="text-sm leading-snug text-slate-800">
          <p className="text-xs text-slate-600">
            Eskalerat av {item.askedByName} · {formatDateTimeSv(item.askedAt)}
          </p>
          <p>{item.question}</p>
          {item.status === "answered" && item.reply ? (
            <>
              <p className="mt-0.5 text-xs text-slate-600">
                Besvarat av {item.repliedByName}
                {item.repliedAt ? ` · ${formatDateTimeSv(item.repliedAt)}` : ""}
              </p>
              <p>Beslut/svar: {item.reply}</p>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}
