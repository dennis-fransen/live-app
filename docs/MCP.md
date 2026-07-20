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
- **Auth:** a shared bearer token (`MCP_AUTH_TOKEN`). The endpoint fails closed
  if the token is unset, and `/api/*` is exempt from the login-redirect
  middleware so the endpoint can authenticate itself.

## Configuration

Set these (server-only) env vars — locally in `.env.local`, and in the Vercel
project settings for production:

```bash
SUPABASE_SERVICE_ROLE_KEY=...          # Supabase → Project Settings → API
HOUSEHOLD_ID=...                       # the households.id row to write into
MCP_AUTH_TOKEN=$(openssl rand -hex 32) # the shared secret
# NEXT_PUBLIC_SITE_URL=https://your-app  # optional, for deep links back to a recipe
```

`SUPABASE_SERVICE_ROLE_KEY` and `MCP_AUTH_TOKEN` are secrets — never expose them
to the browser or commit them.

## Connecting a client

**Claude Code** — add to `.mcp.json` (or `claude mcp add`):

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

**claude.ai** — add a custom connector pointing at the same URL, with an
`Authorization: Bearer …` header.

Then just ask: *"Add this recipe to our app: https://…"*. The agent will read
the page, optionally `find_recipe` first to avoid a duplicate, and
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
