import { corsHeaders, registerClient } from "@/lib/oauth";

// Dynamic client registration (RFC 7591). Claude registers itself here and gets
// a client_id; we're a public client (PKCE, no secret). Kept permissive — the
// real gate is the household password at the authorize step.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    redirect_uris?: unknown;
    client_name?: unknown;
  };

  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

  if (redirectUris.length === 0) {
    return Response.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris is required" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const clientName = typeof body.client_name === "string" ? body.client_name : null;
  const client = await registerClient(clientName, redirectUris);

  return Response.json(
    {
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: corsHeaders() },
  );
}

export function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}
