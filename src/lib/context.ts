import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { HouseholdContext, Member, Category, Household } from "@/lib/types";

// Loads the household context for a signed-in user, provisioning the household
// on first visit via the ensure_household() RPC. Redirects to /login if there
// is no session. Every app page starts by calling this.
export async function getHouseholdContext(): Promise<HouseholdContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: householdId, error: ensureError } =
    await supabase.rpc("ensure_household");
  if (ensureError || !householdId) {
    throw new Error(
      `Could not load your household: ${ensureError?.message ?? "unknown error"}`,
    );
  }

  const [householdRes, membersRes, categoriesRes] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, timezone")
      .eq("id", householdId)
      .single(),
    supabase
      .from("members")
      .select("id, household_id, name, color, is_child, sort_order")
      .eq("household_id", householdId)
      .order("sort_order"),
    supabase
      .from("categories")
      .select("id, household_id, name, color, icon, sort_order")
      .eq("household_id", householdId)
      .order("sort_order"),
  ]);

  if (householdRes.error) throw householdRes.error;

  return {
    household: householdRes.data as Household,
    members: (membersRes.data ?? []) as Member[],
    categories: (categoriesRes.data ?? []) as Category[],
  };
}
