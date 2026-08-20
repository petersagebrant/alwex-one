import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const authLoggingSources = [
  "app/auth/callback/route.ts",
  "app/auth/recovery-flag/route.ts",
  "app/auth/update-password/actions.ts",
  "app/auth/update-password/update-password-form.tsx",
  "components/auth/AuthRecoveryGate.tsx",
  "lib/supabase/proxy.ts",
];

const forbiddenLogPatterns = [
  /\brequestUrl\.href\b/,
  /\b(?:accessToken|refreshToken|tokenHash|oauthError)\b/,
  /\berror\.message\b/,
  /\bString\s*\(\s*error\b/,
  /\b(?:window\.)?location\.(?:href|search|hash)\b/,
  /\.(?:href|search|hash)\b/,
  /\.toString\s*\(/,
  /console\.(?:log|info|warn|error|debug|trace)\s*\(\s*error\b/,
];

function consoleCalls(source: string): string[] {
  return (
    source.match(
      /console\.(?:log|info|warn|error|debug|trace)\s*\([\s\S]*?\);/g,
    ) ?? []
  );
}

describe("auth logging", () => {
  it("never logs auth secrets, full URLs, querystrings, hashes, or errors", () => {
    for (const relativePath of authLoggingSources) {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");

      for (const call of consoleCalls(source)) {
        const sanitizedCall = call.replace(
          /\bBoolean\s*\(\s*(?:code|tokenHash|session)\s*\)/g,
          "true",
        );

        for (const pattern of forbiddenLogPatterns) {
          assert.doesNotMatch(
            sanitizedCall,
            pattern,
            `${relativePath} contains unsafe auth logging: ${call}`,
          );
        }
      }
    }
  });
});
