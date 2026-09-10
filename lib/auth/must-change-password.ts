/** Auth `app_metadata` flag. Users cannot edit `app_metadata`. */
export const MUST_CHANGE_PASSWORD_KEY = "must_change_password";

export const CHANGE_PASSWORD_PATH = "/auth/change-password";

export const MIN_PASSWORD_LENGTH = 8;

export type MustChangePasswordAppMetadata = {
  must_change_password: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** True only for the boolean `true` (never from user_metadata). */
export function mustChangePasswordFromUnknown(source: unknown): boolean {
  if (!isRecord(source)) {
    return false;
  }

  const meta = source.app_metadata;
  if (isRecord(meta)) {
    return meta[MUST_CHANGE_PASSWORD_KEY] === true;
  }

  return source[MUST_CHANGE_PASSWORD_KEY] === true;
}

export function mustChangePasswordFromUser(user: {
  app_metadata?: Record<string, unknown> | null;
} | null): boolean {
  if (!user) {
    return false;
  }
  return user.app_metadata?.[MUST_CHANGE_PASSWORD_KEY] === true;
}

/**
 * Logged-in users with the flag may only stay on these paths.
 * Logout is the sign-out action (posted from the change-password page or login).
 * Static / manifest are already skipped by the proxy matcher.
 */
export function isMustChangePasswordAllowedPath(pathname: string): boolean {
  return (
    pathname === CHANGE_PASSWORD_PATH ||
    pathname.startsWith(`${CHANGE_PASSWORD_PATH}/`) ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback/")
  );
}

/** Admin payload to clear the flag without touching role, area, or other metadata keys. */
export function clearMustChangePasswordAuthUpdate(): {
  app_metadata: { must_change_password: false };
} {
  return { app_metadata: { must_change_password: false } };
}
