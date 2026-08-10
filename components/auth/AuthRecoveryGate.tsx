"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RECOVERY_UPDATE_PATH } from "@/lib/auth/recovery";

const CLIENT_RECOVERY_FLAG = "alwex_pw_recovery_client";

function markClientRecoveryFlag() {
  try {
    window.sessionStorage.setItem(CLIENT_RECOVERY_FLAG, "1");
  } catch {
    // Ignore storage failures.
  }
}

function hasClientRecoveryFlag(): boolean {
  try {
    return window.sessionStorage.getItem(CLIENT_RECOVERY_FLAG) === "1";
  } catch {
    return false;
  }
}

function clearClientRecoveryFlag() {
  try {
    window.sessionStorage.removeItem(CLIENT_RECOVERY_FLAG);
  } catch {
    // Ignore storage failures.
  }
}

function isUpdatePasswordPath(pathname: string | null): boolean {
  return Boolean(
    pathname === RECOVERY_UPDATE_PATH ||
      pathname?.startsWith(`${RECOVERY_UPDATE_PATH}/`),
  );
}

async function setServerRecoveryFlag() {
  try {
    await fetch("/auth/recovery-flag", { method: "POST" });
  } catch {
    console.log("[auth-recovery] recovery-flag POST failed");
  }
}

/**
 * Catches hash-based recovery links (Site URL / Dashboard) and PASSWORD_RECOVERY
 * events so the user is forced to /auth/update-password instead of the app.
 */
export function AuthRecoveryGate() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (error) {
      console.log("[auth-recovery] createClient failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    async function handleHashRecovery() {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) {
        return false;
      }

      const params = new URLSearchParams(hash);
      const type = params.get("type");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (type !== "recovery" || !accessToken || !refreshToken) {
        return false;
      }

      console.log("[auth-recovery] hash recovery tokens detected", {
        pathname,
        type,
      });

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.log("[auth-recovery] setSession from hash failed", {
          message: error.message,
        });
        return false;
      }

      markClientRecoveryFlag();
      await setServerRecoveryFlag();

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );

      if (!cancelled && !isUpdatePasswordPath(pathname)) {
        console.log(
          "[auth-recovery] redirecting hash recovery →",
          RECOVERY_UPDATE_PATH,
        );
        window.location.replace(RECOVERY_UPDATE_PATH);
      }

      return true;
    }

    const authListener = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) {
        return;
      }

      if (event === "PASSWORD_RECOVERY") {
        console.log("[auth-recovery] PASSWORD_RECOVERY event detected", {
          pathname,
          hasSession: Boolean(session),
        });
        markClientRecoveryFlag();
        void setServerRecoveryFlag();

        if (!isUpdatePasswordPath(pathname)) {
          console.log(
            "[auth-recovery] redirecting PASSWORD_RECOVERY →",
            RECOVERY_UPDATE_PATH,
          );
          window.location.replace(RECOVERY_UPDATE_PATH);
        }
      }
    });

    void handleHashRecovery().then((handled) => {
      if (cancelled || handled) {
        return;
      }

      if (
        hasClientRecoveryFlag() &&
        !isUpdatePasswordPath(pathname) &&
        pathname !== "/login" &&
        !pathname?.startsWith("/auth/")
      ) {
        console.log(
          "[auth-recovery] client flag set — forcing update-password",
          { pathname },
        );
        window.location.replace(RECOVERY_UPDATE_PATH);
      }
    });

    return () => {
      cancelled = true;
      authListener.data.subscription.unsubscribe();
    };
  }, [pathname]);

  useEffect(() => {
    if (isUpdatePasswordPath(pathname)) {
      console.log("[auth-recovery] on update-password page");
    }
    if (pathname === "/login") {
      clearClientRecoveryFlag();
    }
  }, [pathname]);

  return null;
}
