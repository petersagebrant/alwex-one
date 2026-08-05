import Link from "next/link";
import type { ReactNode } from "react";

type AppHeaderProps = {
  current?: "home" | "areas";
};

export function AppHeader({ current = "areas" }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#1f2430] bg-[#111827] text-white">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="min-w-0 shrink-0">
            <p className="text-[13px] font-semibold tracking-[0.08em] text-white uppercase">
              Alwex One
            </p>
            <p className="truncate text-xs text-slate-400">
              Målbild och verksamhetsuppföljning
            </p>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink href="/" active={current === "home"}>
              Dashboard
            </NavLink>
            <NavLink href="/areas" active={current === "areas"}>
              Affärsområden
            </NavLink>
          </nav>
        </div>

        <div className="inline-flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#5b5bd6]/20 text-[11px] font-semibold text-[#c7c7ff]"
          >
            PS
          </span>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-xs font-medium text-white">
              Peter Sagebrant
            </p>
            <p className="text-[10px] text-slate-400">VD</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1.5 text-sm transition ${
        active
          ? "bg-white/10 font-medium text-white"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
