import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "./StatusBadge";
import type { UiStatus } from "./types";

export type SummaryCardProps = {
  title: string;
  value: ReactNode;
  description?: string;
  status?: UiStatus;
  href?: string;
  className?: string;
};

export function SummaryCard({
  title,
  value,
  description,
  status,
  href,
  className = "",
}: SummaryCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {description}
        </p>
      ) : null}
    </>
  );

  const sharedClassName = `rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`block transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${sharedClassName}`}
      >
        {content}
      </Link>
    );
  }

  return <article className={sharedClassName}>{content}</article>;
}
