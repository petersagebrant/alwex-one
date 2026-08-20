type BeraknadTypeBadgeProps = {
  className?: string;
};

/** Neutral type label for calculated KPIs — never Grön/Gul/Röd. */
export function BeraknadTypeBadge({ className = "" }: BeraknadTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200/80 bg-slate-50 ${className}`}
    >
      Beräknad
    </span>
  );
}
