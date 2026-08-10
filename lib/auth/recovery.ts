/** Cookie that marks an in-progress password recovery session. */
export const RECOVERY_COOKIE = "alwex_pw_recovery";

export const RECOVERY_UPDATE_PATH = "/auth/update-password";

export function isRecoveryAllowedPath(pathname: string): boolean {
  return (
    pathname === RECOVERY_UPDATE_PATH ||
    pathname.startsWith(`${RECOVERY_UPDATE_PATH}/`) ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback/") ||
    pathname === "/auth/forgot-password" ||
    pathname.startsWith("/auth/forgot-password/") ||
    pathname === "/auth/recovery-flag" ||
    pathname.startsWith("/auth/recovery-flag/")
  );
}
