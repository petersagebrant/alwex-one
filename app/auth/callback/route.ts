import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { getSupabaseEnv } from "@/lib/supabase/env";

function safeNextPath(value: string | null): string {
  if (!value) {
    return "/auth/update-password";
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/auth/update-password";
  }
  if (value === "/login" || value.startsWith("/login/")) {
    return "/auth/update-password";
  }
  // Recovery must never continue straight into the app.
  if (value === "/" || !value.startsWith("/auth/")) {
    return "/auth/update-password";
  }
  return value;
}

function buildRedirectUrl(
  request: NextRequest,
  origin: string,
  pathAndSearch: string,
): URL {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (!isLocalEnv && forwardedHost) {
    return new URL(
      pathAndSearch.startsWith("/") ? pathAndSearch : `/${pathAndSearch}`,
      `https://${forwardedHost}`,
    );
  }

  return new URL(pathAndSearch, origin);
}

function setRecoveryCookie(response: NextResponse) {
  response.cookies.set(RECOVERY_COOKIE, "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
  });
}

/**
 * Handles Supabase Auth redirects (password recovery).
 * Exchanges PKCE code / token_hash for a session, marks recovery pending,
 * then always continues to /auth/update-password.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"));

  console.log("[auth-recovery] callback hit", {
    pathname: requestUrl.pathname,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    type,
    resolvedPath: new URL(next, origin).pathname,
  });

  const oauthError =
    searchParams.get("error_description") ||
    searchParams.get("error") ||
    null;

  if (oauthError) {
    console.log("[auth-recovery] callback oauth/error param", {
      hasError: true,
    });
    return redirectWithError(request, origin);
  }

  const { url, publishableKey } = getSupabaseEnv();
  const redirectTarget = buildRedirectUrl(request, origin, next);
  let response = NextResponse.redirect(redirectTarget);

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.log("[auth-recovery] exchangeCodeForSession failed", {
        hasError: true,
      });
      const pkceMissing = /code verifier/i.test(error.message);
      return redirectWithError(
        request,
        origin,
        pkceMissing
          ? "Återställningslänken kunde inte verifieras i den här webbläsaren. Begär en ny länk via Glömt lösenord? på inloggningssidan och öppna den i samma webbläsare."
          : undefined,
      );
    }

    console.log("[auth-recovery] exchangeCodeForSession ok · recovery event path");
    setRecoveryCookie(response);
    console.log("[auth-recovery] redirecting to", {
      pathname: redirectTarget.pathname,
    });
    return response;
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "email" | "magiclink" | "invite" | "signup",
      token_hash: tokenHash,
    });

    if (error) {
      console.log("[auth-recovery] verifyOtp failed", { hasError: true });
      return redirectWithError(request, origin);
    }

    console.log("[auth-recovery] verifyOtp ok", { type });
    setRecoveryCookie(response);
    console.log("[auth-recovery] redirecting to", {
      pathname: redirectTarget.pathname,
    });
    return response;
  }

  console.log("[auth-recovery] callback missing code/token_hash");
  return redirectWithError(request, origin);
}

function redirectWithError(
  request: NextRequest,
  origin: string,
  message?: string,
) {
  const path =
    "/auth/update-password?error=" +
    encodeURIComponent(
      message ??
        "Länken för lösenordsåterställning är ogiltig eller har gått ut. Begär en ny länk.",
    );
  const target = buildRedirectUrl(request, origin, path);
  console.log("[auth-recovery] redirecting to error page", {
    pathname: target.pathname,
  });
  return NextResponse.redirect(target);
}
