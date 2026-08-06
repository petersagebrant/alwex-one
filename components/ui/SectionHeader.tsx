import type { ReactNode } from "react";

export type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({
  title,
  description,
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-3 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
