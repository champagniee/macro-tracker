import { randomBytes, createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Google's OAuth endpoints are stable/well-known, so these are hardcoded
// rather than fetched from the discovery document — one less network call,
// and Google has never changed these URLs.
const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ISSUER = "https://accounts.google.com";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function getClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set. Add them to .env.local (see .env.example).",
    );
  }
  return { clientId, clientSecret };
}

function base64url(input: Buffer) {
  return input.toString("base64url");
}

export interface PkceParams {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export function generatePkceParams(): PkceParams {
  const state = base64url(randomBytes(32));
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { state, codeVerifier, codeChallenge };
}

export function getGoogleAuthUrl(redirectUri: string, { state, codeChallenge }: PkceParams): string {
  const { clientId } = getClientCredentials();
  const url = new URL(AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Skips the account chooser when the browser already has one Google
  // session — minor UX nicety, not load-bearing.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
}

// Exchanges the authorization code for tokens, then verifies the returned id
// token's signature against Google's live JWKS (not just decoded/trusted) —
// confirms it's genuinely signed by Google for this exact client, not merely
// well-formed.
export async function exchangeCodeForIdentity(code: string, redirectUri: string, codeVerifier: string): Promise<GoogleIdentity> {
  const { clientId, clientSecret } = getClientCredentials();

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }

  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) {
    throw new Error("Google token response did not include an id_token");
  }

  const { payload } = await jwtVerify(idToken, JWKS, { issuer: ISSUER, audience: clientId });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Google id token missing sub/email claims");
  }

  // `given_name`/`name` come from the "profile" scope we requested — fall
  // back to the email's local part on the off chance Google omits them.
  const firstName =
    (typeof payload.given_name === "string" && payload.given_name) ||
    (typeof payload.name === "string" && payload.name.trim().split(/\s+/)[0]) ||
    payload.email.split("@")[0];

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    firstName,
  };
}
