import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except Next internals and static assets.
     * `/_next/*` must never hit the auth gate — a login HTML redirect for a
     * JS/CSS chunk breaks hydration and styling (browser executes HTML as JS).
     * Manifest is public so installability checks work on /login (no SW).
     */
    "/((?!_next/|favicon.ico|manifest\\.webmanifest|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
