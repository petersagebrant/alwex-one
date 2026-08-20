type ReportingStatusBadgeProps = {
  reported: boolean;
  className?: string;
};

/** Manual reporting state — never Grön/Gul/Röd or "Statistik". */
export function ReportingStatusBadge({
  reported,
  className = "",
}: ReportingStatusBadgeProps) {
  if (reported) {
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200/80 bg-slate-50 ${className}`}
      >
        Rapporterad
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200/80 ${className}`}
    >
      Ej rapporterad
    </span>
  );
}
