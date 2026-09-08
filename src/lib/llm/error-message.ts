import { ApiError } from "@google/genai";

const FALLBACK_MESSAGE = "Couldn't get an estimate right now. Try again in a moment.";

// Surfaces the real cause of an estimate failure (missing key, the LLM
// provider's actual status/message, a parse failure) in development, where
// isolating a specific failure matters more than hiding it. Gated behind
// NODE_ENV in production — this app is no longer single-user (public
// foods/recipes, friends invited via Google OAuth), and the real message
// would both name the underlying LLM provider (deliberately kept unbranded
// everywhere else in the UI) and could leak other internal detail.
export function estimateErrorMessage(err: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return FALLBACK_MESSAGE;
  }
  if (err instanceof ApiError) {
    return `Gemini API error (${err.status}): ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return FALLBACK_MESSAGE;
}
