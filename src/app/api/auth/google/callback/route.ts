import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { exchangeCodeForIdentity } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";

function redirectToLogin(request: Request, message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectToLogin(request, oauthError === "access_denied" ? "Google sign-in was cancelled" : oauthError);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("mt_oauth_state")?.value;
  const codeVerifier = cookieStore.get("mt_oauth_verifier")?.value;
  cookieStore.delete("mt_oauth_state");
  cookieStore.delete("mt_oauth_verifier");

  if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
    return redirectToLogin(request, "Google sign-in failed — please try again");
  }

  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();

  let identity;
  try {
    identity = await exchangeCodeForIdentity(code, redirectUri, codeVerifier);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    return redirectToLogin(request, "Google sign-in failed — please try again");
  }

  // Find by googleId first (returning user), then by email (an existing
  // password account signing in with Google for the first time — link
  // rather than create a duplicate account for the same address), else
  // create a brand-new Google-only account.
  let user = await db.query.users.findFirst({ where: eq(users.googleId, identity.googleId) });
  let isNewUser = false;

  if (!user) {
    const existingByEmail = await db.query.users.findFirst({ where: eq(users.email, identity.email) });
    if (existingByEmail) {
      [user] = await db
        .update(users)
        .set({ googleId: identity.googleId, updatedAt: new Date() })
        .where(eq(users.id, existingByEmail.id))
        .returning();
    } else {
      [user] = await db
        .insert(users)
        .values({ email: identity.email, googleId: identity.googleId, name: identity.firstName })
        .returning();
      isNewUser = true;
    }
  }

  await createSession({ sub: user.id, email: user.email });

  // `welcome=1` only on a genuinely new account — Today shows a one-time
  // welcome toast for it, same as the email/password register flow does
  // immediately client-side.
  const destination = isNewUser ? "/?welcome=1" : "/";
  return NextResponse.redirect(new URL(destination, request.url));
}
