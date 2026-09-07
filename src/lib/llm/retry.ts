import { ApiError } from "@google/genai";

// Free-tier Gemini genuinely 503s under load (observed live, not hypothetical
// — see estimate-macros.ts) — retry that and 429 (rate limited), both
// transient, with a short backoff. Anything else (bad request, model not
// found, auth) won't be fixed by retrying, so those fail immediately.
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [500, 1500];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err instanceof ApiError && RETRYABLE_STATUS.has(err.status);
      if (!retryable || attempt === RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  // Unreachable — the loop always returns or throws — but keeps TypeScript
  // happy about a guaranteed return type.
  throw new Error("unreachable");
}
