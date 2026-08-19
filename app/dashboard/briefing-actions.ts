"use server";

import { AI_ENDPOINTS, consumeAiRateLimit } from "@/lib/ai/rate-limit";
import {
  AiRateLimitError,
  requireRateLimitThenRun,
} from "@/lib/ai/rate-limit-core";
import { requireVdAiPrincipal } from "@/lib/auth/ai-principal";
import { generateVdBriefing } from "@/services/assistant";

/**
 * Background AI refresh for VD Briefing.
 * Keeps local content on provider failure and returns a clear rate-limit notice.
 */
export async function fetchVdBriefingAction(): Promise<{
  content: string | null;
  error: string | null;
}> {
  const principal = await requireVdAiPrincipal();

  try {
    const content = await requireRateLimitThenRun(
      () => consumeAiRateLimit(principal, AI_ENDPOINTS.vdBriefing),
      () => generateVdBriefing(principal),
    );
    return { content, error: null };
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      return { content: null, error: error.message };
    }
    console.warn("[vd-briefing] AI upgrade skipped — keeping local briefing");
    return { content: null, error: null };
  }
}
