import Link from "next/link";
import type { ReactNode } from "react";
import type { InfoPanelVariant } from "./types";

export type InfoPanelProps = {
  title: string;
  children: ReactNode;
  variant?: InfoPanelVariant;
  footer?: ReactNode;
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
  titleHref?: string;
  action?: ReactNode;
};

const variantClass: Record<InfoPanelVariant, string> = {
  "vd-comment": "border-slate-200/80 bg-white",
  info: "border-sky-200/80 bg-sky-50/60",
  warning: "border-amber-200/80 bg-amber-50/70",
  "ai-summary": "border-indigo-200/70 bg-indigo-50/40",
};

const variantLabel: Record<InfoPanelVariant, string | null> = {
  "vd-comment": "VD-kommentar",
  info: "Information",
  warning: "Varning",
  "ai-summary": "AI-sammanfattning",
};

export function InfoPanel({
  title,
  children,
  variant = "info",
  footer,
  showLabel = true,
  compact = false,
  className = "",
  titleHref,
  action,
}: InfoPanelProps) {
  const eyebrow = showLabel ? variantLabel[variant] : null;
  const headingClass = `font-semibold tracking-tight text-slate-900 ${
    compact ? "text-base sm:text-lg" : "text-lg sm:text-xl"
  }`;
  const heading = (
    <h2 className={`${headingClass} ${action ? "" : eyebrow ? "mt-1" : ""}`}>
      {titleHref ? (
        <Link href={titleHref} className="hover:underline underline-offset-4">
          {title}
        </Link>
      ) : (
        title
      )}
    </h2>
  );

  return (
    <section
      className={`rounded-2xl border shadow-[0_6px_18px_rgba(15,23,42,0.05)] ${
        compact ? "p-4" : "p-5 sm:p-6"
      } ${variantClass[variant]} ${className}`}
    >
      {eyebrow ? (
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {eyebrow}
        </p>
      ) : null}
      {action ? (
        <div
          className={`flex flex-wrap items-start justify-between gap-3 ${
            eyebrow ? "mt-1" : ""
          }`}
        >
          {heading}
          <div className="shrink-0">{action}</div>
        </div>
      ) : (
        heading
      )}
      <div
        className={`text-sm text-slate-700 ${
          compact ? "mt-2 leading-snug" : "mt-3 leading-relaxed"
        }`}
      >
        {children}
      </div>
      {footer ? (
        <div
          className={`rounded-xl border border-slate-200/70 bg-white/80 text-xs text-slate-600 ${
            compact ? "mt-3 px-3 py-2" : "mt-5 px-4 py-3"
          }`}
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}
