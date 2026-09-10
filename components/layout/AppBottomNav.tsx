"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { signOutAction } from "@/app/login/actions";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth/must-change-password";
import {
  isMobileMoreNavActive,
  splitMobileAppNav,
  type AppNavItem,
  type AppNavKey,
} from "@/lib/layout/appNav";

type AppBottomNavProps = {
  current?: AppNavKey;
  items: AppNavItem[];
  signedIn?: boolean;
};

export function AppBottomNav({
  current = "home",
  items,
  signedIn = false,
}: AppBottomNavProps) {
  const { tabs, more } = splitMobileAppNav(items);
  const [moreOpen, setMoreOpen] = useState(false);
  const morePanelId = useId();
  const moreActive = isMobileMoreNavActive(current, more);
  const showMore = more.length > 0 || signedIn;

  useEffect(() => {
    if (!moreOpen) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Stäng menyn"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id={morePanelId}
            role="menu"
            aria-label="Mer"
            className="absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] rounded-t-2xl border border-b-0 border-white/10 bg-[#111827] p-2 pb-3 text-white shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
          >
            {more.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                role="menuitem"
                aria-current={current === item.key ? "page" : undefined}
                onClick={() => setMoreOpen(false)}
                className={`flex items-center rounded-lg px-3 py-2.5 text-sm ${
                  current === item.key
                    ? "bg-white/10 font-medium text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {signedIn ? (
              <>
                <Link
                  href={CHANGE_PASSWORD_PATH}
                  role="menuitem"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  Byt lösenord
                </Link>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    Logga ut
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav
        data-mobile-bottom-nav
        aria-label="Mobilnavigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[#1f2430] bg-[#111827] text-white md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul
          className={`grid h-14 ${showMore ? "grid-cols-4" : "grid-cols-3"}`}
        >
          {tabs.map((item) => (
            <li key={item.key} className="min-w-0">
              <Link
                href={item.href}
                aria-current={current === item.key ? "page" : undefined}
                className={`flex h-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight ${
                  current === item.key
                    ? "font-semibold text-white"
                    : "font-medium text-slate-400"
                }`}
              >
                <TabIcon name={item.key} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          ))}
          {showMore ? (
            <li className="min-w-0">
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-controls={morePanelId}
                aria-current={moreActive && !moreOpen ? "page" : undefined}
                onClick={() => setMoreOpen((open) => !open)}
                className={`flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight ${
                  moreActive || moreOpen
                    ? "font-semibold text-white"
                    : "font-medium text-slate-400"
                }`}
              >
                <MoreIcon />
                <span>Mer</span>
              </button>
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  );
}

function TabIcon({ name }: { name: AppNavKey }) {
  if (name === "home") {
    return (
      <NavGlyph>
        <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </NavGlyph>
    );
  }
  if (name === "areas") {
    return (
      <NavGlyph>
        <rect x="4" y="4" width="7" height="7" rx="1.2" />
        <rect x="13" y="4" width="7" height="7" rx="1.2" />
        <rect x="4" y="13" width="7" height="7" rx="1.2" />
        <rect x="13" y="13" width="7" height="7" rx="1.2" />
      </NavGlyph>
    );
  }
  return (
    <NavGlyph>
      <path d="M5 18V9" />
      <path d="M10 18V6" />
      <path d="M15 18v-7" />
      <path d="M20 18V4" />
    </NavGlyph>
  );
}

function MoreIcon() {
  return (
    <NavGlyph>
      <circle cx="6.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="17.5" cy="12" r="1.4" />
    </NavGlyph>
  );
}

function NavGlyph({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {children}
    </svg>
  );
}
