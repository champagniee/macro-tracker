import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY is not set — add it to .env.local to use AI estimates.");
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}
