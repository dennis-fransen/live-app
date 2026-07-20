import { createClient } from "@supabase/supabase-js";

// A service-role Supabase client for server-only, non-interactive callers (the
// MCP endpoint). It BYPASSES Row Level Security, so it must never be reached
// from the browser and every write must set household_id explicitly. Guarded by
// the MCP bearer token at the route layer.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Service client not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
