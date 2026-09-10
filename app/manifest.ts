import type { MetadataRoute } from "next";

/**
 * Installable PWA manifest (Next 16 `app/manifest.ts` → `/manifest.webmanifest`).
 *
 * No service worker: Chrome/Edge/Android can install from a valid manifest + HTTPS
 * (localhost is treated as secure). iOS does not need a SW either — Safari share →
 * “Lägg till på hemskärmen” uses this file plus `app/apple-icon.png`.
 *
 * Do not add a SW that caches HTML, RSC, API, dashboard, KPI, or goals.
 * Stale operational data must never be served as current after reconnect.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LEIR",
    short_name: "LEIR",
    description: "Ledning, målstyrning och verksamhetsuppföljning",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "sv",
    // Header chrome `bg-[#111827]`. Splash uses the same so the black mark blends.
    theme_color: "#111827",
    background_color: "#111827",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
