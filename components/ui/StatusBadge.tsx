import type { UiStatus } from "./types";
import { uiStatusBadgeClass, uiStatusDotClass } from "./types";

export type StatusBadgeProps = {
  status: UiStatus;
  label?: string;
  className?: string;
};

export function StatusBadge({
  status,
  label,
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${uiStatusBadgeClass[status]} ${className}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${uiStatusDotClass[status]}`}
      />
      {label ?? status}
    </span>
  );
}
