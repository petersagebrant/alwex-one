import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/require-user";
import { signOutAction } from "@/app/login/actions";

export type AppNavKey =
  | "home"
  | "areas"
  | "goals"
  | "activities"
  | "decisions"
  | "kpis";

type AppHeaderProps = {
  current?: AppNavKey;
};

const navItems: { key: AppNavKey; href: string; label: string }[] = [
  { key: "home", href: "/", label: "Dashboard" },
  { key: "areas", href: "/areas", label: "Affärsområden" },
  { key: "goals", href: "/admin/goals", label: "Mål" },
  { key: "activities", href: "/admin/activities", label: "Aktiviteter" },
  { key: "decisions", href: "/admin/decisions", label: "Beslut" },
  { key: "kpis", href: "/admin/kpis", label: "KPI" },
];

function initialsFromEmail(email: string | null): string {
  if (!email) {
    return "?";
  }
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export async function AppHeader({ current = "home" }: AppHeaderProps) {
  const user = await getCurrentUser();
  const label = user?.email ?? "Ej inloggad";
  const initials = initialsFromEmail(user?.email ?? null);

  return (
    <header className="sticky top-0 z-30 border-b border-[#1f2430] bg-[#111827] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-8 lg:py-0 lg:h-14">
        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <Link href="/" className="min-w-0 shrink-0">
            <p className="text-[13px] font-semibold tracking-[0.08em] text-white uppercase">
              Alwex One
            </p>
            <p className="truncate text-xs text-slate-400">
              Målbild och verksamhetsuppföljning
            </p>
          </Link>

          <nav
            aria-label="Huvudnavigation"
            className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 lg:pb-0"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.key}
                href={item.href}
                active={current === item.key}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="inline-flex max-w-full items-center gap-2.5 self-start rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 lg:self-auto">
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#5b5bd6]/20 text-[11px] font-semibold text-[#c7c7ff]"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">{label}</p>
            <p className="text-[10px] text-slate-400">Inloggad</p>
          </div>
          {user ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Logga ut
              </button>
            </form>
          ) : null}
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
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm transition ${
        active
          ? "bg-white/10 font-medium text-white"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
