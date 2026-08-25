/**
 * Authorization failure while already signed in.
 * Never send these users to /login — proxy bounces them to / and drops ?error=.
 */
export function denyRedirectHref(message: string): string {
  return `/?error=${encodeURIComponent(message)}`;
}

/** Unauthenticated only. */
export function loginRedirectHref(message?: string): string {
  if (!message) {
    return "/login";
  }
  return `/login?error=${encodeURIComponent(message)}`;
}
