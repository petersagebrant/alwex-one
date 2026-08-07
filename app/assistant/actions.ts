"use server";

import { requireUser } from "@/lib/auth/require-user";
import { askAssistant as runAssistant } from "@/services/assistant";

/**
 * Server action used by the assistant UI.
 * Returns a plain answer string so the UI can later keep working
 * when the service switches from rules to OpenAI.
 */
export async function askAssistant(question: string): Promise<string> {
  await requireUser();

  const trimmed = question.trim();
  if (!trimmed) {
    return "Skriv en fråga om verksamheten för att få svar.";
  }

  return runAssistant(trimmed);
}
