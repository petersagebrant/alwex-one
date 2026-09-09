export type GreetingNameFields = {
  fullName?: string | null;
  displayName?: string | null;
  name?: string | null;
  email?: string | null;
};

export type GreetingTimeOfDay = "morgon" | "dag" | "kväll";

const ROLE_LIKE_NAME = /^(vd|vice[\s._-]*vd)$/i;

function isRoleLikeName(value: string): boolean {
  return ROLE_LIKE_NAME.test(value.trim());
}

function titleCaseGivenName(token: string): string {
  if (token === token.toLowerCase() || token === token.toUpperCase()) {
    return token.charAt(0).toLocaleUpperCase("sv-SE") + token.slice(1).toLocaleLowerCase("sv-SE");
  }
  return token;
}

function givenNameFromPersonName(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.includes("@")) {
    return givenNameFromEmail(trimmed);
  }
  if (isRoleLikeName(trimmed)) {
    return null;
  }
  const token = trimmed.split(/\s+/)[0]?.trim() ?? "";
  if (!token || isRoleLikeName(token)) {
    return null;
  }
  return titleCaseGivenName(token);
}

function givenNameFromEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const local = (trimmed.includes("@") ? trimmed.split("@")[0] : trimmed)?.trim() ?? "";
  if (!local) {
    return null;
  }
  const segments = local.split(/[._-]/).filter(Boolean);
  if (
    isRoleLikeName(local) ||
    segments.some((segment) => isRoleLikeName(segment))
  ) {
    return null;
  }
  const token = segments[0]?.trim() ?? "";
  if (!token) {
    return null;
  }
  return titleCaseGivenName(token);
}

/** First given name from profile fields. Never uses a role label as a name. */
export function givenNameFromProfileFields(
  input?: GreetingNameFields | null,
): string | null {
  const fields = input ?? {};
  for (const raw of [fields.fullName, fields.displayName, fields.name]) {
    const given = givenNameFromPersonName(raw);
    if (given) {
      return given;
    }
  }
  return givenNameFromEmail(fields.email);
}

export function greetingTimeOfDay(
  now: Date = new Date(),
): GreetingTimeOfDay {
  const hourText = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  const hour = Number.parseInt(hourText, 10);
  if (hour < 10) {
    return "morgon";
  }
  if (hour < 18) {
    return "dag";
  }
  return "kväll";
}

/** Personal greeting from a given name. Role tokens are not used as names. */
export function formatPersonalGreeting(
  givenName?: string | null,
  now: Date = new Date(),
): string {
  const name = givenNameFromPersonName(givenName);
  const prefix = greetingTimeOfDay(now);
  return name ? `God ${prefix} ${name}.` : `God ${prefix}.`;
}
