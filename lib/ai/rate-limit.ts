import "server-only";

import type { AiPrincipal } from "@/lib/ai/security";
import type { AiRateLimitDecision } from "@/lib/ai/rate-limit-core";
import { createClient } from "@/lib/supabase/server";

export const AI_ENDPOINTS = {
  assistant: "assistant_v1",
  vdBriefing: "vd_briefing_v1",
} as const;

export type AiEndpoint = (typeof AI_ENDPOINTS)[keyof typeof AI_ENDPOINTS];

export async function consumeAiRateLimit(
  principal: AiPrincipal,
  endpoint: AiEndpoint,
): Promise<AiRateLimitDecision> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_ai_rate_limit", {
    p_endpoint: endpoint,
  });

  if (error) {
    throw new Error("Kunde inte kontrollera AI-gränsen.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (
    !row ||
    typeof row.allowed !== "boolean" ||
    typeof row.retry_after_seconds !== "number" ||
    typeof row.limit_value !== "number" ||
    typeof row.remaining !== "number"
  ) {
    throw new Error("Ogiltigt svar från AI-gränskontrollen.");
  }

  // RPC derives auth.uid/profile independently; this assertion prevents an
  // accidentally reused session from being accepted by the application layer.
  if (!principal.userId) {
    throw new Error("Ogiltig AI-principal.");
  }

  return {
    allowed: row.allowed,
    retryAfterSeconds: row.retry_after_seconds,
    limit: row.limit_value,
    remaining: row.remaining,
  };
}
