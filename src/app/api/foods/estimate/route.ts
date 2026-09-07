import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { estimateMacros } from "@/lib/llm/estimate-macros";
import { estimateErrorMessage } from "@/lib/llm/error-message";

const estimateRequestSchema = z
  .object({
    description: z.string().trim().optional(),
    // Base64, no "data:image/..." prefix — capped generously above a typical
    // phone photo (a 5MB JPEG is ~6.7MB as base64) rather than left unbounded.
    image: z
      .object({
        data: z.string().min(1).max(10 * 1024 * 1024),
        mimeType: z.string().regex(/^image\//, "Only image files are supported"),
      })
      .optional(),
  })
  .refine((v) => (v.description && v.description.length >= 2) || v.image, {
    message: "Describe what you ate, attach a photo, or both",
  });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to get an estimate" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = estimateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    const estimate = await estimateMacros(parsed.data.description, parsed.data.image);
    return NextResponse.json({ estimate });
  } catch (err) {
    // Covers a missing GEMINI_API_KEY, the model being rate-limited/overloaded
    // (a real, observed failure mode on Gemini's free tier), or a malformed
    // response — none of these should ever 500. Surfaces the real cause
    // (temporary debugging aid) instead of one generic message.
    console.error("estimate_macros failed:", err);
    return NextResponse.json({ error: estimateErrorMessage(err) }, { status: 502 });
  }
}
