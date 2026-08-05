import type { StatusTone } from "@/types";
import { statusBadgeClass, statusDotClass } from "@/lib/status/styles";

type StatusPillProps = {
  status: StatusTone;
  className?: string;
};

export function StatusPill({ status, className = "" }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass[status]} ${className}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass[status]}`}
      />
      {status}
    </span>
  );
}
