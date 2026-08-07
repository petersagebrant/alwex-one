import { getCurrentUser } from "@/lib/auth/require-user";

export type AuditFieldChange = {
  field: string;
  from: string | null;
  to: string | null;
};

export type AuditChangesPayload = {
  fields: AuditFieldChange[];
};

export function normalizeAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/**
 * Diff selected fields. Returns only fields that actually changed.
 */
export function collectFieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): AuditFieldChange[] {
  const changes: AuditFieldChange[] = [];

  for (const field of fields) {
    const from = normalizeAuditValue(before[field]);
    const to = normalizeAuditValue(after[field]);
    if (from !== to) {
      changes.push({ field, from, to });
    }
  }

  return changes;
}

export function hasFieldChange(
  changes: AuditFieldChange[],
  ...fields: string[]
): boolean {
  return changes.some((change) => fields.includes(change.field));
}

export function formatEntityChangeDescription(
  entityLabel: string,
  name: string,
  changes: AuditFieldChange[],
): string {
  if (changes.length === 0) {
    return `Uppdaterade ${entityLabel} "${name}"`;
  }

  const parts = changes.map((change) => {
    const from = change.from ?? "—";
    const to = change.to ?? "—";
    return `${change.field}: ${from} → ${to}`;
  });

  return `Uppdaterade ${entityLabel} "${name}" (${parts.join("; ")})`;
}

export async function resolveActorName(
  preferred?: string | null,
  fallback = "System",
): Promise<string> {
  const preferredName = preferred?.trim();
  if (preferredName) {
    return preferredName;
  }

  try {
    const user = await getCurrentUser();
    const email = user?.email?.trim();
    if (email) {
      const local = email.split("@")[0]?.trim();
      if (local) {
        const token = local.split(/[._-]/)[0] ?? local;
        if (token) {
          return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
        }
      }
      return email;
    }
  } catch {
    // Fall through to default.
  }

  return fallback;
}
