import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generatePkceParams, getGoogleAuthUrl } from "@/lib/auth/google";

const TEMP_COOKIE_MAX_AGE = 60 * 10; // 10 minutes — only needs to survive the redirect round trip

// Starts the Google sign-in flow: generates CSRF `state` + a PKCE pair,
// stashes them in short-lived cookies (scoped to this route's own path, so
// they don't linger alongside the real session cookie), then redirects to
// Google's consent screen. The callback route reads these back to verify
// the response actually came from the request we made.
export async function GET(request: Request) {
  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
  const { state, codeVerifier, codeChallenge } = generatePkceParams();

  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth/google",
    maxAge: TEMP_COOKIE_MAX_AGE,
  };
  cookieStore.set("mt_oauth_state", state, cookieOptions);
  cookieStore.set("mt_oauth_verifier", codeVerifier, cookieOptions);

  try {
    return NextResponse.redirect(getGoogleAuthUrl(redirectUri, { state, codeVerifier, codeChallenge }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in is not configured";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
  }
}
