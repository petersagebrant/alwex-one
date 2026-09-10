import { updateOperationalReportStatusAction } from "@/app/daglig-styrning/actions";
import {
  OPERATIONAL_REPORT_STATUS_LABELS,
  type OperationalReportStatus,
} from "@/types/operational-report";
import {
  boardNewStatusBadgeClass,
  boardPrimaryButtonClass,
  boardStatusBadgeClass,
} from "./boardStyles";

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
  const badgeClass =
    status === "ny" ? boardNewStatusBadgeClass : boardStatusBadgeClass;

  return (
    <>
      <span className={badgeClass}>
        {OPERATIONAL_REPORT_STATUS_LABELS[status]}
      </span>
      {canUpdate && status === "ny" ? (
        <form action={updateOperationalReportStatusAction} className="inline-flex">
          <input type="hidden" name="id" value={reportId} />
          <input type="hidden" name="status" value="hanteras" />
          <button type="submit" className={boardPrimaryButtonClass}>
            Hanteras
          </button>
        </form>
      ) : null}
    </>
  );
}
