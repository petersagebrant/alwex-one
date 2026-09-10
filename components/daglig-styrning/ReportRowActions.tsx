import { updateOperationalReportStatusAction } from "@/app/daglig-styrning/actions";
import type { GoalOwnerOption } from "@/lib/goals/owner";
import type { OperationalReportStatus } from "@/types/operational-report";
import {
  boardActionClusterClass,
  boardGhostButtonClass,
} from "./boardStyles";
import { CreateLinkedActionControls } from "./CreateLinkedActionControls";
import { ReportStatusControls } from "./ReportStatusControls";

type ReportRowActionsProps = {
  reportId: string;
  businessAreaId: string;
  status: OperationalReportStatus;
  canUpdate: boolean;
  defaultDeadline: string;
  owners: GoalOwnerOption[];
};

export function ReportRowActions({
  reportId,
  businessAreaId,
  status,
  canUpdate,
  defaultDeadline,
  owners,
}: ReportRowActionsProps) {
  const statusControls = (
    <ReportStatusControls
      reportId={reportId}
      status={status}
      canUpdate={canUpdate}
    />
  );

  if (!canUpdate) {
    return <div className={boardActionClusterClass}>{statusControls}</div>;
  }

  return (
    <CreateLinkedActionControls
      sourceType="report"
      sourceId={reportId}
      businessAreaId={businessAreaId}
      defaultDeadline={defaultDeadline}
      owners={owners}
      leading={statusControls}
      extraOverflow={
        <form action={updateOperationalReportStatusAction} className="inline-flex">
          <input type="hidden" name="id" value={reportId} />
          <input type="hidden" name="status" value="klar" />
          <button type="submit" className={boardGhostButtonClass}>
            Stäng
          </button>
        </form>
      }
    />
  );
}
