import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createServiceClient } from "@/lib/supabase/service";

// A minimal OAuth 2.0 authorization server for the recipe MCP endpoint. It
// exists only so claude.ai custom connectors (which speak OAuth, not a static
// header) can authenticate. Public clients + PKCE (S256); access/refresh tokens
// are signed JWTs so they need no storage; authorization codes are one-time and
// live in oauth_codes.

export const ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const REFRESH_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 days
export const CODE_TTL_SECONDS = 120; // 2 minutes
export const OAUTH_SCOPE = "recipes";

function jwtSecret(): Uint8Array {
  const secret = process.env.OAUTH_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "OAUTH_JWT_SECRET is not set (or too short) — needed to sign MCP OAuth tokens.",
    );
  }
  return new TextEncoder().encode(secret);
}

export interface AccessClaims extends JWTPayload {
  typ: "access" | "refresh";
  scope?: string;
}

async function sign(typ: "access" | "refresh", ttl: number): Promise<string> {
  return new SignJWT({ typ, scope: OAUTH_SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject("household")
    .setExpirationTime(`${ttl}s`)
    .sign(jwtSecret());
}

export function signAccessToken(): Promise<string> {
  return sign("access", ACCESS_TTL_SECONDS);
}

export function signRefreshToken(): Promise<string> {
  return sign("refresh", REFRESH_TTL_SECONDS);
}

// Verify a bearer JWT of the expected type. Returns the claims, or null if the
// token is missing/invalid/expired/wrong-type.
export async function verifyToken(
  token: string,
  expected: "access" | "refresh",
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    if ((payload as AccessClaims).typ !== expected) return null;
    return payload as AccessClaims;
  } catch {
    return null;
  }
}

// ---- PKCE (S256 only) -------------------------------------------------------
function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  const computed = base64url(createHash("sha256").update(verifier).digest());
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- The household approval password ---------------------------------------
export function passwordIsValid(provided: string | undefined | null): boolean {
  const expected = process.env.MCP_OAUTH_PASSWORD;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function randomToken(bytes = 32): string {
  return base64url(randomBytes(bytes));
}

// CORS for the OAuth metadata + token endpoints — MCP clients running in a
// browser (claude.ai) need these.
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// ---- Dynamic client registration (RFC 7591), stored in oauth_clients --------
export interface OAuthClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
}

export async function registerClient(
  clientName: string | null,
  redirectUris: string[],
): Promise<OAuthClient> {
  const supabase = createServiceClient();
  const client_id = randomToken(24);
  const { error } = await supabase.from("oauth_clients").insert({
    client_id,
    client_name: clientName,
    redirect_uris: redirectUris,
  });
  if (error) throw new Error(`Could not register client: ${error.message}`);
  return { client_id, client_name: clientName, redirect_uris: redirectUris };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("oauth_clients")
    .select("client_id,client_name,redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as OAuthClient) ?? null;
}

// ---- Authorization codes, stored in oauth_codes -----------------------------
export interface AuthCodeInput {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string;
}

export async function issueAuthCode(input: AuthCodeInput): Promise<string> {
  const supabase = createServiceClient();
  const code = randomToken(32);
  const expires_at = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();
  const { error } = await supabase.from("oauth_codes").insert({
    code,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: input.codeChallengeMethod,
    scope: input.scope,
    expires_at,
  });
  if (error) throw new Error(`Could not issue code: ${error.message}`);
  return code;
}

export interface StoredAuthCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string | null;
  expires_at: string;
}

// Fetch and delete a code in one shot (one-time use). Returns null if it doesn't
// exist. Expiry is checked by the caller so an expired code is still consumed.
export async function consumeAuthCode(code: string): Promise<StoredAuthCode | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("oauth_codes")
    .delete()
    .eq("code", code)
    .select("code,client_id,redirect_uri,code_challenge,code_challenge_method,scope,expires_at")
    .maybeSingle();
  return (data as StoredAuthCode) ?? null;
}
