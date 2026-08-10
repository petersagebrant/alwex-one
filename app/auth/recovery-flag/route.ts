import { NextResponse } from "next/server";
import { RECOVERY_COOKIE } from "@/lib/auth/recovery";

/**
 * Sets the httpOnly recovery cookie from the browser after hash/PASSWORD_RECOVERY.
 */
export async function POST() {
  console.log("[auth-recovery] recovery-flag POST — setting cookie");
  const response = NextResponse.json({ ok: true });
  response.cookies.set(RECOVERY_COOKIE, "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60,
  });
  return response;
}

export async function DELETE() {
  console.log("[auth-recovery] recovery-flag DELETE — clearing cookie");
  const response = NextResponse.json({ ok: true });
  response.cookies.set(RECOVERY_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}
