"use client";

import { useState, type ReactNode } from "react";

type VdBriefingCollapsibleProps = {
  title: string;
  icon?: string;
  titleClass: string;
  accentBar: string;
  /** Start collapsed. Used for mobile-only compact briefing cards. */
  defaultCollapsed?: boolean;
  children: ReactNode;
};

export function VdBriefingCollapsible({
  title,
  icon,
  titleClass,
  accentBar,
  defaultCollapsed = true,
  children,
}: VdBriefingCollapsibleProps) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <article className="h-fit rounded-xl border border-slate-200/80 bg-white p-2 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        <span
          aria-hidden
          className={`h-4 w-1 shrink-0 rounded-full ${accentBar}`}
        />
        <span
          className={`flex min-w-0 items-center gap-1.5 text-sm font-semibold tracking-tight ${titleClass}`}
        >
          {icon ? (
            <span aria-hidden className="text-[13px] leading-none">
              {icon}
            </span>
          ) : null}
          <span>{title}</span>
        </span>
        <span aria-hidden className="ml-auto shrink-0 text-sm text-slate-400">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open ? <div className="mt-2">{children}</div> : null}
    </article>
  );
}
