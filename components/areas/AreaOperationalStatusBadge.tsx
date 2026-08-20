import { ReportingStatusBadge } from "@/components/kpis/ReportingStatusBadge";
import { StatusPill } from "@/components/common/StatusPill";
import { StatusBadge } from "@/components/ui";
import type { AreaOperationalStatus } from "@/lib/kpi/areaOperationalStatus";

type AreaOperationalStatusBadgeProps = {
  status: AreaOperationalStatus;
  variant?: "badge" | "pill";
  className?: string;
};

/**
 * Area display status: G/Y/R from reported TARGET, or existing Ej rapporterad badge.
 */
export function AreaOperationalStatusBadge({
  status,
  variant = "badge",
  className = "",
}: AreaOperationalStatusBadgeProps) {
  if (status == null) {
    return <ReportingStatusBadge reported={false} className={className} />;
  }
  if (variant === "pill") {
    return <StatusPill status={status} className={className} />;
  }
  return <StatusBadge status={status} className={className} />;
}
