import {
  ACCESS_TTL_SECONDS,
  OAUTH_SCOPE,
  consumeAuthCode,
  corsHeaders,
  signAccessToken,
  signRefreshToken,
  verifyPkceS256,
  verifyToken,
} from "@/lib/oauth";

// The token endpoint. Exchanges an authorization code (with PKCE) for tokens,
// and refreshes an access token. Tokens are signed JWTs, so no token storage.
export const runtime = "nodejs";

function oauthError(error: string, description?: string, status = 400): Response {
  return Response.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status, headers: { ...corsHeaders(), "cache-control": "no-store" } },
  );
}

async function readParams(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as Record<string, string>;
  }
  return Object.fromEntries(new URLSearchParams(await req.text()));
}

async function issueTokens(): Promise<Response> {
  const [access_token, refresh_token] = await Promise.all([
    signAccessToken(),
    signRefreshToken(),
  ]);
  return Response.json(
    {
      access_token,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token,
      scope: OAUTH_SCOPE,
    },
    { headers: { ...corsHeaders(), "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const p = await readParams(req);
  const grant = p.grant_type;

  if (grant === "authorization_code") {
    if (!p.code || !p.code_verifier || !p.redirect_uri) {
      return oauthError("invalid_request", "code, code_verifier and redirect_uri are required");
    }
    const stored = await consumeAuthCode(p.code);
    if (!stored) return oauthError("invalid_grant", "Unknown or already-used code");
    if (new Date(stored.expires_at).getTime() < Date.now()) {
      return oauthError("invalid_grant", "Code expired");
    }
    if (p.client_id && stored.client_id !== p.client_id) {
      return oauthError("invalid_grant", "client_id mismatch");
    }
    if (stored.redirect_uri !== p.redirect_uri) {
      return oauthError("invalid_grant", "redirect_uri mismatch");
    }
    if (!verifyPkceS256(p.code_verifier, stored.code_challenge)) {
      return oauthError("invalid_grant", "PKCE verification failed");
    }
    return issueTokens();
  }

  if (grant === "refresh_token") {
    if (!p.refresh_token) return oauthError("invalid_request", "refresh_token is required");
    const claims = await verifyToken(p.refresh_token, "refresh");
    if (!claims) return oauthError("invalid_grant", "Invalid or expired refresh token");
    return issueTokens();
  }

  return oauthError("unsupported_grant_type", `Unsupported grant_type: ${grant ?? "(none)"}`);
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}
