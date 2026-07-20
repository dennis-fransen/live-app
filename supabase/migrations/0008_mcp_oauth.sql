-- Life App — 0008 MCP OAuth
-- Storage for the tiny OAuth 2.0 authorization server that fronts the recipe
-- MCP endpoint (src/app/api/oauth/*), so claude.ai custom connectors (web /
-- mobile / desktop) can authenticate — those clients speak OAuth, not the
-- static bearer that Claude Code uses.
--
-- Two short-lived bookkeeping tables. Access/refresh tokens themselves are
-- signed JWTs (no storage needed). These tables are touched ONLY by the
-- service-role client from server routes: RLS is enabled with no policies, so
-- the anon/browser role can never read them while the service role bypasses RLS.

-- Dynamically-registered OAuth clients (RFC 7591). Public clients (PKCE, no
-- secret). redirect_uris are validated at authorize/token time.
create table oauth_clients (
  client_id     text primary key,
  client_name   text,
  redirect_uris text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- One-time authorization codes. Consumed (deleted) on token exchange; a nightly
-- sweep isn't required but expired rows are ignored on read.
create table oauth_codes (
  code                  text primary key,
  client_id             text not null,
  redirect_uri          text not null,
  code_challenge        text not null,
  code_challenge_method text not null default 'S256',
  scope                 text,
  expires_at            timestamptz not null,
  created_at            timestamptz not null default now()
);

create index oauth_codes_expiry_idx on oauth_codes (expires_at);

alter table oauth_clients enable row level security;
alter table oauth_codes   enable row level security;
-- No policies on purpose: only the service-role key (which bypasses RLS) may
-- touch these. Nothing reachable from the browser can.
