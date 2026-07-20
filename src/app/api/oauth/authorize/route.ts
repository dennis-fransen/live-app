import {
  OAUTH_SCOPE,
  getClient,
  issueAuthCode,
  passwordIsValid,
} from "@/lib/oauth";

// The authorization endpoint. GET renders a small household-password gate; POST
// checks the password and, if right, issues a one-time code and redirects back
// to the client. PKCE (S256) is required; the code is bound to the challenge.
export const runtime = "nodejs";

interface AuthParams {
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  response_type: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function errorPage(message: string, status = 400): Response {
  return new Response(page(`<p class="err">${esc(message)}</p>`), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function page(inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to the recipe box</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; max-width: 22rem; margin: 12vh auto; padding: 0 1.25rem; }
  h1 { font-size: 1.15rem; }
  p { color: #666; font-size: .95rem; line-height: 1.4; }
  form { display: flex; flex-direction: column; gap: .75rem; margin-top: 1.25rem; }
  input[type=password] { padding: .7rem .8rem; font-size: 1rem; border: 1px solid #bbb; border-radius: .6rem; }
  button { padding: .7rem; font-size: 1rem; font-weight: 600; border: 0; border-radius: .6rem; background: #b4632f; color: #fff; cursor: pointer; }
  .err { color: #c0392b; }
</style></head><body>${inner}</body></html>`;
}

function formPage(p: AuthParams, error?: string): string {
  const hidden = (name: string, value: string) =>
    `<input type="hidden" name="${name}" value="${esc(value)}">`;
  return page(`
    <h1>🍞 Connect to the recipe box</h1>
    <p>Enter the household password to let this app add and read recipes.</p>
    ${error ? `<p class="err">${esc(error)}</p>` : ""}
    <form method="post" action="/api/oauth/authorize">
      ${hidden("client_id", p.client_id)}
      ${hidden("redirect_uri", p.redirect_uri)}
      ${hidden("state", p.state)}
      ${hidden("code_challenge", p.code_challenge)}
      ${hidden("code_challenge_method", p.code_challenge_method)}
      ${hidden("scope", p.scope)}
      ${hidden("response_type", p.response_type)}
      <input type="password" name="password" placeholder="Household password" autofocus required>
      <button type="submit">Allow</button>
    </form>`);
}

function readParams(src: URLSearchParams): AuthParams {
  return {
    client_id: src.get("client_id") ?? "",
    redirect_uri: src.get("redirect_uri") ?? "",
    state: src.get("state") ?? "",
    code_challenge: src.get("code_challenge") ?? "",
    code_challenge_method: src.get("code_challenge_method") ?? "S256",
    scope: src.get("scope") || OAUTH_SCOPE,
    response_type: src.get("response_type") ?? "code",
  };
}

// Shared validation of the client + PKCE parameters. Returns an error string or
// null if everything checks out.
async function validate(p: AuthParams): Promise<string | null> {
  if (p.response_type !== "code") return "Unsupported response_type (expected 'code').";
  if (!p.client_id) return "Missing client_id.";
  if (!p.redirect_uri) return "Missing redirect_uri.";
  if (!p.code_challenge) return "Missing PKCE code_challenge.";
  if (p.code_challenge_method !== "S256") return "Only the S256 PKCE method is supported.";
  const client = await getClient(p.client_id);
  if (!client) return "Unknown client_id.";
  if (!client.redirect_uris.includes(p.redirect_uri)) {
    return "redirect_uri does not match a registered value for this client.";
  }
  return null;
}

export async function GET(req: Request) {
  const p = readParams(new URL(req.url).searchParams);
  const err = await validate(p);
  if (err) return errorPage(err);
  return new Response(formPage(p), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text());
  const p = readParams(form);
  const password = form.get("password") ?? "";

  const err = await validate(p);
  if (err) return errorPage(err);

  if (!passwordIsValid(password)) {
    return new Response(formPage(p, "Wrong password — try again."), {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const code = await issueAuthCode({
    clientId: p.client_id,
    redirectUri: p.redirect_uri,
    codeChallenge: p.code_challenge,
    codeChallengeMethod: p.code_challenge_method,
    scope: p.scope,
  });

  const dest = new URL(p.redirect_uri);
  dest.searchParams.set("code", code);
  if (p.state) dest.searchParams.set("state", p.state);
  return Response.redirect(dest.toString(), 302);
}
