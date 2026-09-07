import { ApiError } from "@google/genai";

// Temporary debugging aid — surfaces the real cause of an estimate failure
// (missing key, Gemini's actual status/message, a parse failure) instead of
// a single generic "try again" message, so a specific failure can actually
// be isolated. Safe to expose directly since this is a single-user app.
export function estimateErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return `Gemini API error (${err.status}): ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Couldn't get an estimate right now. Try again in a moment.";
}
