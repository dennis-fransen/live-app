import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project, ProjectPart, ProjectWithParts } from "@/lib/types";

// V1 is a single household in Norway; format money as NOK. (When per-household
// currency lands, thread a currency code through here.)
export const CURRENCY = "NOK";

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function partLineTotal(p: Pick<ProjectPart, "unit_price" | "quantity">): number {
  return Number(p.unit_price) * Number(p.quantity);
}

// Project total = base cost + every part's line total.
export function projectTotal(
  baseCost: number,
  parts: Pick<ProjectPart, "unit_price" | "quantity">[],
): number {
  return Number(baseCost) + parts.reduce((sum, p) => sum + partLineTotal(p), 0);
}

// What's still to buy = line totals of the parts not yet marked bought.
export function partsRemaining(parts: ProjectPart[]): number {
  return parts
    .filter((p) => !p.is_bought)
    .reduce((sum, p) => sum + partLineTotal(p), 0);
}

// All projects for a household, each with its parts, ordered by manual priority.
export async function fetchProjects(
  supabase: SupabaseClient,
  householdId: string,
): Promise<ProjectWithParts[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id,household_id,title,description,room,base_cost,sort_order,is_done,created_at," +
        "parts:project_parts(id,household_id,project_id,title,store,url,unit_price,quantity,is_bought,sort_order)",
    )
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("sort_order", { ascending: true, foreignTable: "project_parts" });

  if (error) throw error;

  const rows = (data ?? []) as unknown as (Project & { parts: ProjectPart[] })[];
  // PostgREST returns numeric columns as strings for precision; coerce once here.
  return rows.map((r) => ({
    ...r,
    base_cost: Number(r.base_cost),
    parts: (r.parts ?? []).map((p) => ({
      ...p,
      unit_price: Number(p.unit_price),
      quantity: Number(p.quantity),
    })),
  }));
}
