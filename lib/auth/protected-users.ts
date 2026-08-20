/** Hardcoded system accounts that must never be deleted, disabled, or demoted. */
export const PROTECTED_VD_USER_ID = "169202b9-ee9a-47f3-9e0d-5e69898c6f7d";
export const PROTECTED_AO_TEST_USER_ID =
  "6d867c73-2196-4c8f-a247-7e91f9f12aca";

const PROTECTED_USER_IDS = new Set<string>([
  PROTECTED_VD_USER_ID,
  PROTECTED_AO_TEST_USER_ID,
]);

export function isProtectedUserId(userId: string): boolean {
  return PROTECTED_USER_IDS.has(userId);
}

export function protectedUserMutationError(
  userId: string,
  action: "delete" | "disable" | "role",
): string | null {
  if (!isProtectedUserId(userId)) {
    return null;
  }

  if (action === "delete") {
    return "Skyddat systemkonto kan inte raderas.";
  }
  if (action === "disable") {
    return "Skyddat systemkonto kan inte inaktiveras.";
  }
  if (userId === PROTECTED_VD_USER_ID) {
    return "VD-kontot kan inte nedgraderas.";
  }
  return "AO-testkontot kan inte byta roll.";
}
