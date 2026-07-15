#!/usr/bin/env bash
# Deploy Life App to Vercel (hybrid setup: Supabase is provisioned manually).
#
# Requires these to be present in the environment:
#   VERCEL_TOKEN                  - Vercel access token (scope to your team)
#   NEXT_PUBLIC_SUPABASE_URL      - from your Supabase project (Settings -> API)
#   NEXT_PUBLIC_SUPABASE_ANON_KEY - the anon/public key (safe in the browser)
# Optional:
#   VERCEL_SCOPE                  - team slug/id if deploying under a team
#   VERCEL_PROJECT                - project name (default: life-app)
#
# Network egress must allow api.vercel.com / vercel.com / *.vercel.app.
set -euo pipefail

PROJECT="${VERCEL_PROJECT:-life-app}"
SCOPE_ARG=()
[ -n "${VERCEL_SCOPE:-}" ] && SCOPE_ARG=(--scope "$VERCEL_SCOPE")

need() { [ -n "${!1:-}" ] || { echo "Missing env var: $1" >&2; exit 1; }; }
need VERCEL_TOKEN
need NEXT_PUBLIC_SUPABASE_URL
need NEXT_PUBLIC_SUPABASE_ANON_KEY

command -v vercel >/dev/null || npm i -g vercel

TOKEN=(--token "$VERCEL_TOKEN")

echo "==> Linking/creating Vercel project: $PROJECT"
vercel link --yes --project "$PROJECT" "${TOKEN[@]}" "${SCOPE_ARG[@]}"

# (Re)set the build-time public env vars for all targets. Remove-then-add keeps
# this idempotent across re-runs.
set_env() {
  local key="$1" val="$2" target
  for target in production preview development; do
    vercel env rm "$key" "$target" --yes "${TOKEN[@]}" "${SCOPE_ARG[@]}" >/dev/null 2>&1 || true
    printf '%s' "$val" | vercel env add "$key" "$target" "${TOKEN[@]}" "${SCOPE_ARG[@]}"
  done
}

echo "==> Setting Supabase env vars"
set_env NEXT_PUBLIC_SUPABASE_URL "$NEXT_PUBLIC_SUPABASE_URL"
set_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$NEXT_PUBLIC_SUPABASE_ANON_KEY"

echo "==> Deploying to production"
URL=$(vercel deploy --prod --yes "${TOKEN[@]}" "${SCOPE_ARG[@]}")
echo ""
echo "Deployed: $URL"
echo ""
echo "Final step (manual): add this URL to Supabase -> Authentication ->"
echo "URL Configuration -> Redirect URLs, so magic-link sign-in works."
