# Recipe-import MCP server

An [MCP](https://modelcontextprotocol.io) server, served from this same Next.js
app at **`/api/mcp`**, that lets an agent (Claude) read a recipe off any website
and store it in our own format. You point the agent at a page — *"add this
recipe: <url>"* — it reads the page, translates/normalizes it, and calls
`create_recipe`, and the recipe shows up in the **Recipes** tab instantly via
the realtime we already have.

The agent does the fetching and parsing; the server only persists and queries.
That split is deliberate — an LLM maps messy, heterogeneous recipe pages (any
language, any unit style) into a clean schema far better than a fixed scraper.

## Tools

| Tool | What it does |
| --- | --- |
| `create_recipe` | Insert a recipe + ordered ingredients + steps, in our format. |
| `find_recipe` | Case-insensitive title search — used to avoid duplicates. |
| `list_recipes` | List everything currently in the box. |

`create_recipe` takes: `title`, optional `category`, `yield`, `prep_minutes`,
`cook_minutes`, `source` (the page URL), `description`, plus `ingredients`
(ordered `{ amount, name }`) and `steps` (ordered plain-text strings).

## How it's built

- **Route:** `src/app/api/[transport]/route.ts` via [`mcp-handler`](https://www.npmjs.com/package/mcp-handler)
  (stateless streamable HTTP — no Redis needed). The dynamic `[transport]`
  segment resolves `/api/mcp`.
- **Storage:** `src/lib/recipes-import.ts` + a service-role Supabase client
  (`src/lib/supabase/service.ts`). The service role **bypasses RLS**, so it is
  server-only and reachable only through the bearer-guarded route.
- **Auth:** two accepted credentials — a shared bearer token (`MCP_AUTH_TOKEN`)
  for Claude Code, and OAuth access tokens for claude.ai connectors (see below).
  The endpoint fails closed if neither is valid. `/api/*` and `/.well-known/*`
  are exempt from the login-redirect middleware so the endpoint and its OAuth
  discovery documents are reachable.
- **OAuth server:** claude.ai custom connectors authenticate via OAuth, not a
  static header, so the app hosts a tiny OAuth 2.0 authorization server
  (`src/app/api/oauth/*`, `src/lib/oauth.ts`): dynamic client registration +
  PKCE authorization-code flow, gated by a household password. Access/refresh
  tokens are signed JWTs (no token storage); one-time codes + registered
  clients live in the `oauth_codes` / `oauth_clients` tables (migration 0008).

## Configuration

Set these (server-only) env vars — locally in `.env.local`, and in the Vercel
project settings for production:

```bash
SUPABASE_SERVICE_ROLE_KEY=...            # Supabase → Project Settings → API
HOUSEHOLD_ID=...                         # the households.id row to write into
MCP_AUTH_TOKEN=$(openssl rand -hex 32)   # bearer for Claude Code
OAUTH_JWT_SECRET=$(openssl rand -hex 32) # signs OAuth tokens (claude.ai)
MCP_OAUTH_PASSWORD=...                    # typed on the connector approval screen
# NEXT_PUBLIC_SITE_URL=https://your-app   # optional, for deep links back to a recipe
```

`SUPABASE_SERVICE_ROLE_KEY`, `MCP_AUTH_TOKEN`, and `OAUTH_JWT_SECRET` are
secrets — never expose them to the browser or commit them. Apply migration
`0008_mcp_oauth.sql` before using the claude.ai connector.

## Connecting a client

### Claude Code (static bearer)

Add to `.mcp.json` (or `claude mcp add`) — Claude Code can send a custom header:

```json
{
  "mcpServers": {
    "recipes": {
      "type": "http",
      "url": "https://your-app.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN" }
    }
  }
}
```

### claude.ai — web, mobile & desktop (OAuth connector)

The custom-connector UI doesn't accept a static header, so it uses the OAuth
flow above. Add the connector **from web or desktop** (you can't add new ones on
mobile, but once added it syncs to the mobile apps and works there):

1. **Settings → Connectors → Add → "Add custom connector".**
2. URL: `https://your-app.vercel.app/api/mcp`. Leave Advanced settings empty —
   the server does dynamic client registration, so no client ID/secret needed.
3. Click **Connect**. You'll be sent to the approval page; enter
   `MCP_OAUTH_PASSWORD`. Claude stores the resulting token and reconnects.

One connector covers web, desktop, and the iOS/Android apps (it's account-level).

Then, on any surface, just ask: *"Add this recipe to our app: https://…"*. The
agent reads the page, optionally `find_recipe` first to avoid a duplicate, and
`create_recipe`.

## Local check

```bash
# 401 without a token:
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Accept: application/json, text/event-stream" -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"1"}}}'

# 200 + serverInfo with the token:
curl -s -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
  -H "Accept: application/json, text/event-stream" -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/mcp \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"1"}}}'
```
