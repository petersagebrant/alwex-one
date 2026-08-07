"use server";

import { requireUser } from "@/lib/auth/require-user";
import { generateVdBriefing } from "@/services/assistant";

/**
 * Background AI refresh for VD Briefing.
 * Returns AI text on success, or null on timeout/error (never throws to the UI).
 */
export async function fetchVdBriefingAction(): Promise<string | null> {
  await requireUser();

  try {
    return await generateVdBriefing();
  } catch (error) {
    console.error(error);
    return null;
  }
}
