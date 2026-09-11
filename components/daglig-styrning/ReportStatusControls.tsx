import {
  OPERATIONAL_REPORT_STATUS_LABELS,
  type OperationalReportStatus,
} from "@/types/operational-report";
import { HandleReportStatusButton } from "./HandleReportStatusButton";
import { boardReportStatusBadgeClass } from "./boardStyles";

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
  const showHandle = canUpdate && status === "ny";
  const showStatusBadge = status !== "hanteras";

  return (
    <>
      {showStatusBadge ? (
        <span className={boardReportStatusBadgeClass(status)}>
          {OPERATIONAL_REPORT_STATUS_LABELS[status]}
        </span>
      ) : null}
      {showHandle ? (
        <span className="relative z-10 inline-flex">
          <HandleReportStatusButton reportId={reportId} />
        </span>
      ) : null}
    </>
  );
}
