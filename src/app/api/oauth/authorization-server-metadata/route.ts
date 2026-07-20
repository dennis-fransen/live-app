import { getPublicOrigin } from "mcp-handler";
import { corsHeaders } from "@/lib/oauth";

// RFC 8414 authorization-server metadata. Reached via a rewrite from
// /.well-known/oauth-authorization-server. Advertises the authorize/token/
// registration endpoints and that we're a PKCE public-client server.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/api/oauth/authorize`,
      token_endpoint: `${origin}/api/oauth/token`,
      registration_endpoint: `${origin}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["recipes"],
    },
    { headers: corsHeaders() },
  );
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}
