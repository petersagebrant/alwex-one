import type { GoalOwnerOption } from "@/lib/goals/owner";
import type { OperationalReportStatus } from "@/types/operational-report";
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
  return (
    <div className="flex flex-col items-end gap-1.5">
      <ReportStatusControls
        reportId={reportId}
        status={status}
        canUpdate={canUpdate}
      />
      {canUpdate ? (
        <CreateLinkedActionControls
          sourceType="report"
          sourceId={reportId}
          businessAreaId={businessAreaId}
          defaultDeadline={defaultDeadline}
          owners={owners}
        />
      ) : null}
    </div>
  );
}
