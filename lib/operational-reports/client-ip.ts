import { createHash } from "node:crypto";

const IP_HASH_PREFIX = "operational-report-ip:";

export function clientIpFromHeaders(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return (
    headerStore.get("x-real-ip")?.trim() ||
    headerStore.get("cf-connecting-ip")?.trim() ||
    "local"
  );
}

/** SHA-256 hash of the client IP. Never store the raw IP. */
export function hashClientIp(ip: string): string {
  return createHash("sha256")
    .update(`${IP_HASH_PREFIX}${ip.trim()}`)
    .digest("hex");
}
