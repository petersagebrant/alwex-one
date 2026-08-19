export type AiCacheIdentity = {
  feature: string;
  version: number;
  role: string;
  userId: string;
  scope: string;
};

export function buildAiCacheKey(identity: AiCacheIdentity): string {
  return [
    identity.feature,
    `v${identity.version}`,
    identity.role,
    identity.userId,
    identity.scope,
  ].join(":");
}

type Entry<T> = { value: T; expiresAt: number };

export class ScopedSingleflightCache<T> {
  private readonly values = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  get(key: string, now = Date.now()): T | null {
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt <= now) {
      if (entry) this.values.delete(key);
      return null;
    }
    return entry.value;
  }

  async getOrCreate(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
    now = () => Date.now(),
  ): Promise<T> {
    const cached = this.get(key, now());
    if (cached !== null) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const created = factory()
      .then((value) => {
        this.values.set(key, { value, expiresAt: now() + ttlMs });
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, created);
    return created;
  }

  clear(): void {
    this.values.clear();
    this.inFlight.clear();
  }
}
