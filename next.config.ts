import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server is started on `localhost`; Safari/bookmarks often use `127.0.0.1`.
  // Without this, Next returns 403 "Unauthorized" for `/_next/static/*` chunks
  // when Origin is http://127.0.0.1:3000 — JS never runs, CSS looks broken.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
