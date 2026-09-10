import assert from "node:assert/strict";
import { describe, it } from "node:test";
import manifest from "./manifest";

describe("PWA web app manifest", () => {
  it("returns JSON with name LEIR, standalone display, and required icons", () => {
    const payload = manifest();

    assert.equal(payload.name, "LEIR");
    assert.equal(payload.short_name, "LEIR");
    assert.equal(payload.display, "standalone");
    assert.equal(payload.start_url, "/");
    assert.equal(payload.theme_color, "#111827");
    assert.equal(payload.background_color, "#111827");

    const icons = payload.icons ?? [];
    assert.ok(icons.length >= 2, "expected at least 192 and 512 icons");

    const sizes = new Set(icons.map((icon) => icon.sizes));
    assert.ok(sizes.has("192x192"));
    assert.ok(sizes.has("512x512"));
    assert.ok(icons.every((icon) => icon.src && icon.type === "image/png"));
    assert.ok(icons.some((icon) => icon.purpose === "maskable"));
  });

  it("GET /manifest.webmanifest returns the same LEIR standalone JSON", async (t) => {
    const origin = process.env.LEIR_DEV_ORIGIN ?? "http://localhost:3002";
    let response: Response;
    try {
      response = await fetch(`${origin}/manifest.webmanifest`, {
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      t.skip("dev server not running");
      return;
    }

    assert.equal(response.ok, true);
    const contentType = response.headers.get("content-type") ?? "";
    assert.match(contentType, /json|webmanifest/i);

    const body = (await response.json()) as ReturnType<typeof manifest>;
    assert.equal(body.name, "LEIR");
    assert.equal(body.short_name, "LEIR");
    assert.equal(body.display, "standalone");
    assert.ok(Array.isArray(body.icons) && body.icons.length >= 2);
  });
});
