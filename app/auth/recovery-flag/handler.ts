type RecoveryFlagDependencies = {
  cookieName: string;
  hasAuthenticatedUser: () => Promise<boolean>;
  secureCookie: boolean;
};

function singleHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed && !trimmed.includes(",") ? trimmed : null;
}

function trustedRequestOrigin(request: Request): string | null {
  const forwardedHost = singleHeaderValue(
    request.headers.get("x-forwarded-host"),
  );
  const forwardedProto = singleHeaderValue(
    request.headers.get("x-forwarded-proto"),
  )?.toLowerCase();

  // Vercel overwrites these headers. A self-hosted reverse proxy must do the
  // same (and strip client-supplied values) before forwarding requests.
  if (forwardedHost || forwardedProto) {
    if (
      !forwardedHost ||
      (forwardedProto !== "http" && forwardedProto !== "https")
    ) {
      return null;
    }
    return parseOrigin(forwardedProto, forwardedHost);
  }

  const host = singleHeaderValue(request.headers.get("host"));
  if (!host) {
    return null;
  }

  let protocol: string;
  try {
    protocol = new URL(request.url).protocol.slice(0, -1).toLowerCase();
  } catch {
    return null;
  }

  if (protocol !== "http" && protocol !== "https") {
    return null;
  }
  return parseOrigin(protocol, host);
}

function parseOrigin(protocol: string, host: string): string | null {
  if (
    !host ||
    host.includes("/") ||
    host.includes("\\") ||
    host.includes("@") ||
    /\s/.test(host)
  ) {
    return null;
  }

  try {
    const parsed = new URL(`${protocol}://${host}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function isEmptyJsonObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

function jsonResponse(status: number): Response {
  return Response.json(status === 200 ? { ok: true } : { ok: false }, {
    status,
  });
}

function recoveryCookie(
  cookieName: string,
  secureCookie: boolean,
): string {
  return [
    `${cookieName}=1`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secureCookie ? "Secure" : null,
    "Max-Age=3600",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function handleRecoveryFlagPost(
  request: Request,
  dependencies: RecoveryFlagDependencies,
): Promise<Response> {
  if (request.headers.get("content-type")?.toLowerCase() !== "application/json") {
    return jsonResponse(403);
  }

  const origin = singleHeaderValue(request.headers.get("origin"));
  const expectedOrigin = trustedRequestOrigin(request);
  if (!origin || !expectedOrigin) {
    return jsonResponse(403);
  }

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    return jsonResponse(403);
  }
  if (normalizedOrigin !== origin || normalizedOrigin !== expectedOrigin) {
    return jsonResponse(403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400);
  }
  if (!isEmptyJsonObject(body)) {
    return jsonResponse(400);
  }

  let hasUser = false;
  try {
    hasUser = await dependencies.hasAuthenticatedUser();
  } catch {
    hasUser = false;
  }
  if (!hasUser) {
    return jsonResponse(401);
  }

  const response = jsonResponse(200);
  response.headers.set(
    "set-cookie",
    recoveryCookie(dependencies.cookieName, dependencies.secureCookie),
  );
  return response;
}
