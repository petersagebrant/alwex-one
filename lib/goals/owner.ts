import { APP_ROLE_LABELS, type AppRole } from "@/lib/auth/roles";

export type GoalOwnerOption = {
  id: string;
  displayName: string;
  role?: AppRole;
};

export function profileAssignmentLabel(profile: {
  display_name: string;
  role: AppRole;
}): string {
  const name = profile.display_name.trim();
  if (name) {
    return name;
  }
  return APP_ROLE_LABELS[profile.role];
}

export function toGoalOwnerOptions(
  profiles: Array<{
    id: string;
    display_name: string;
    role: AppRole;
    disabled_at: string | null;
  }>,
): GoalOwnerOption[] {
  return profiles
    .filter((profile) => !profile.disabled_at)
    .map((profile) => ({
      id: profile.id,
      displayName: profileAssignmentLabel(profile),
      role: profile.role,
    }))
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "sv", { sensitivity: "base" }),
    );
}
