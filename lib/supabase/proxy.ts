import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isRecoveryAllowedPath,
  RECOVERY_COOKIE,
  RECOVERY_UPDATE_PATH,
} from "@/lib/auth/recovery";
import { getSupabaseEnv } from "./env";

function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/auth/")
  );
}

/** Next internals / static files must never be redirected to /login HTML. */
function isAssetOrNextInternalPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$/i.test(pathname)
  );
}

function safeInternalPath(value: string | null, fallback = "/"): string {
  if (!value) {
    return fallback;
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (value === "/login" || value.startsWith("/login/")) {
    return fallback;
  }
  return value;
}

/**
 * Copy cookies from the Supabase session response onto a new response.
 * Required when redirecting so auth cookie refresh is not lost.
 */
function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

/**
 * Supabase Dashboard "Send password recovery" uses Site URL as redirect_to
 * (often `/`), not `/auth/callback`. Catch auth codes/token hashes anywhere
 * and route them through the callback → update-password flow.
 */
function redirectAuthParamsToCallback(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/auth/callback" || pathname.startsWith("/auth/callback/")) {
    return null;
  }

  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (!code && !(tokenHash && type)) {
    return null;
  }

  const callbackUrl = request.nextUrl.clone();
  callbackUrl.pathname = "/auth/callback";
  callbackUrl.search = "";
  if (code) {
    callbackUrl.searchParams.set("code", code);
  }
  if (tokenHash) {
    callbackUrl.searchParams.set("token_hash", tokenHash);
  }
  if (type) {
    callbackUrl.searchParams.set("type", type);
  }
  callbackUrl.searchParams.set("next", RECOVERY_UPDATE_PATH);

  console.log("[auth-recovery] proxy intercepted auth params → callback", {
    from: pathname,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    type,
    toPath: callbackUrl.pathname,
  });

  return NextResponse.redirect(callbackUrl);
}

/**
 * Refreshes the Auth session and redirects unauthenticated users to /login.
 * Must preserve supabaseResponse cookies on every returned response.
 */
export async function updateSession(request: NextRequest) {
  // Belt-and-suspenders: matcher should already skip these, but never auth-gate
  // asset URLs (login HTML as JS/CSS → hydration never starts).
  if (isAssetOrNextInternalPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const authParamRedirect = redirectAuthParamsToCallback(request);
  if (authParamRedirect) {
    return authParamRedirect;
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  // Validate JWT (do not use getSession for auth decisions).
  let user: unknown = null;
  try {
    const { data } = await supabase.auth.getClaims();
    user = data?.claims ?? null;
  } catch {
    user = null;
  }

  const pathname = request.nextUrl.pathname;
  const publicAuth = isPublicAuthPath(pathname);
  const recoveryPending =
    request.cookies.get(RECOVERY_COOKIE)?.value === "1";

  // Recovery session must finish on update-password — never Dashboard.
  if (recoveryPending && !isRecoveryAllowedPath(pathname)) {
    const recoveryUrl = request.nextUrl.clone();
    recoveryUrl.pathname = RECOVERY_UPDATE_PATH;
    recoveryUrl.search = "";

    console.log("[auth-recovery] proxy recovery-gate redirect", {
      from: pathname,
      to: RECOVERY_UPDATE_PATH,
      hasUser: Boolean(user),
    });

    const redirectResponse = NextResponse.redirect(recoveryUrl);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  // /login and /auth/* must never be auth-gated.
  if (!user && !publicAuth) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const nextPath = `${pathname}${request.nextUrl.search}`;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", nextPath);

    const redirectResponse = NextResponse.redirect(loginUrl);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  // Already signed in — leave the login page (unless recovery is pending).
  if (user && publicAuth && pathname.startsWith("/login")) {
    const nextPath = recoveryPending
      ? RECOVERY_UPDATE_PATH
      : safeInternalPath(request.nextUrl.searchParams.get("next"));
    // nextPath may include ?query (e.g. /report/kpis?area=<uuid>) — preserve it.
    const target = new URL(nextPath, request.nextUrl.origin);

    console.log("[auth-recovery] proxy signed-in leave /login", {
      toPath: target.pathname,
      recoveryPending,
    });

    const redirectResponse = NextResponse.redirect(target);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  return supabaseResponse;
}
