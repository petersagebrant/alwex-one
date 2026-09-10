import {
  OPERATIONAL_REPORT_STATUS_LABELS,
  OPERATIONAL_REPORT_STATUSES,
  type OperationalReportStatus,
} from "@/types/operational-report";
import { updateOperationalReportStatusAction } from "@/app/daglig-styrning/actions";

type ReportStatusControlsProps = {
  reportId: string;
  status: OperationalReportStatus;
  canUpdate: boolean;
};

export function ReportStatusControls({
  reportId,
  status,
  canUpdate,
}: ReportStatusControlsProps) {
  if (!canUpdate) {
    return (
      <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
        {OPERATIONAL_REPORT_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-wrap gap-1">
      {OPERATIONAL_REPORT_STATUSES.map((next) => (
        <form key={next} action={updateOperationalReportStatusAction}>
          <input type="hidden" name="id" value={reportId} />
          <input type="hidden" name="status" value={next} />
          <button
            type="submit"
            disabled={next === status}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
              next === status
                ? "bg-[#0b1220] text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            } disabled:cursor-default`}
          >
            {OPERATIONAL_REPORT_STATUS_LABELS[next]}
          </button>
        </form>
      ))}
    </div>
  );
}
