import type { SupabaseClient } from "@supabase/supabase-js";
import type { OccurrenceWithDefinition } from "@/lib/types";

export const OCCURRENCE_SELECT =
  "id,household_id,definition_id,due_date,status,assignee_id,notes,completed_at,completed_by," +
  "definition:task_definitions(title,notes,kind,completable,scope,owner_member_id,category_id,recurrence_type,interval_count,interval_unit)";

// All open occurrences for a household. Views filter this small set client-side.
export async function fetchOpenOccurrences(
  supabase: SupabaseClient,
  householdId: string,
): Promise<OccurrenceWithDefinition[]> {
  const { data, error } = await supabase
    .from("task_occurrences")
    .select(OCCURRENCE_SELECT)
    .eq("household_id", householdId)
    .eq("status", "open")
    .order("due_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as OccurrenceWithDefinition[];
}
