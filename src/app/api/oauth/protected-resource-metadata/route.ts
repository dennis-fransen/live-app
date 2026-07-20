import { getPublicOrigin } from "mcp-handler";
import { corsHeaders } from "@/lib/oauth";

// RFC 9728 protected-resource metadata. Reached via a rewrite from
// /.well-known/oauth-protected-resource. Tells the client which authorization
// server protects the MCP endpoint — here, this same app.
export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);
  return Response.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ["header"],
      scopes_supported: ["recipes"],
    },
    { headers: corsHeaders() },
  );
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}
