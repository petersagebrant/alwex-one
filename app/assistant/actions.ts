"use server";

import { AI_ENDPOINTS, consumeAiRateLimit } from "@/lib/ai/rate-limit";
import { requireRateLimitThenRun } from "@/lib/ai/rate-limit-core";
import { requireAiPrincipal } from "@/lib/auth/ai-principal";
import { askAssistant as runAssistant } from "@/services/assistant";

/**
 * Server action used by the assistant UI.
 * Returns a plain answer string so the UI can later keep working
 * when the service switches from rules to OpenAI.
 */
export async function askAssistant(question: string): Promise<string> {
  const principal = await requireAiPrincipal();

  const trimmed = question.trim();
  if (!trimmed) {
    return "Skriv en fråga om verksamheten för att få svar.";
  }
  if (trimmed.length > 2_000) {
    throw new Error("Frågan är för lång. Kort ned den till högst 2 000 tecken.");
  }

  return requireRateLimitThenRun(
    () => consumeAiRateLimit(principal, AI_ENDPOINTS.assistant),
    () => runAssistant(trimmed, principal),
  );
}
