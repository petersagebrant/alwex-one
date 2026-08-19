export type AiRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  limit: number;
  remaining: number;
};

export class AiRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      `AI-gränsen är nådd. Försök igen om ${Math.max(1, retryAfterSeconds)} sekunder.`,
    );
    this.name = "AiRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function requireRateLimitThenRun<T>(
  consume: () => Promise<AiRateLimitDecision>,
  run: () => Promise<T>,
): Promise<T> {
  const decision = await consume();
  if (!decision.allowed) {
    throw new AiRateLimitError(decision.retryAfterSeconds);
  }
  return run();
}
