import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recipe } from "@/lib/types";

// The structured payload the MCP `create_recipe` tool accepts — this IS our
// format. The agent reads a page (in whatever language / units) and maps it to
// this shape; the server just persists it. Kept deliberately close to the DB
// columns so there's no lossy translation layer.
export interface RecipeImportPayload {
  title: string;
  category?: string | null;
  recipe_yield?: string | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  source?: string | null;
  description?: string | null;
  ingredients: { amount?: string | null; name: string }[];
  steps: string[];
}

export interface CreatedRecipe {
  id: string;
  title: string;
  ingredientCount: number;
  stepCount: number;
}

// Insert a recipe plus its ordered ingredients and steps under the configured
// household. Best-effort cleanup if a child insert fails, so we don't leave a
// half-imported recipe behind.
export async function createRecipeFromPayload(
  supabase: SupabaseClient,
  householdId: string,
  payload: RecipeImportPayload,
): Promise<CreatedRecipe> {
  const title = payload.title.trim();
  if (!title) throw new Error("A recipe title is required.");

  const { data: recipe, error: recipeErr } = await supabase
    .from("recipes")
    .insert({
      household_id: householdId,
      title,
      category: payload.category?.trim() || null,
      recipe_yield: payload.recipe_yield?.trim() || null,
      prep_minutes: normalizeMinutes(payload.prep_minutes),
      cook_minutes: normalizeMinutes(payload.cook_minutes),
      source: payload.source?.trim() || null,
      description: payload.description?.trim() || null,
    })
    .select("id")
    .single();

  if (recipeErr || !recipe) {
    throw new Error(`Could not create recipe: ${recipeErr?.message ?? "unknown error"}`);
  }
  const recipeId = (recipe as Pick<Recipe, "id">).id;

  const ingredientRows = payload.ingredients
    .map((ing, i) => ({
      household_id: householdId,
      recipe_id: recipeId,
      amount: ing.amount?.trim() || null,
      name: ing.name.trim(),
      sort_order: i,
    }))
    .filter((r) => r.name.length > 0);

  const stepRows = payload.steps
    .map((body, i) => ({
      household_id: householdId,
      recipe_id: recipeId,
      body: body.trim(),
      sort_order: i,
    }))
    .filter((r) => r.body.length > 0);

  if (ingredientRows.length > 0) {
    const { error } = await supabase.from("recipe_ingredients").insert(ingredientRows);
    if (error) {
      await supabase.from("recipes").delete().eq("id", recipeId);
      throw new Error(`Could not add ingredients: ${error.message}`);
    }
  }

  if (stepRows.length > 0) {
    const { error } = await supabase.from("recipe_steps").insert(stepRows);
    if (error) {
      await supabase.from("recipes").delete().eq("id", recipeId);
      throw new Error(`Could not add steps: ${error.message}`);
    }
  }

  return {
    id: recipeId,
    title,
    ingredientCount: ingredientRows.length,
    stepCount: stepRows.length,
  };
}

export interface RecipeBrief {
  id: string;
  title: string;
  category: string | null;
}

// A lightweight list so the agent can dedupe before importing.
export async function listRecipesBrief(
  supabase: SupabaseClient,
  householdId: string,
): Promise<RecipeBrief[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id,title,category")
    .eq("household_id", householdId)
    .eq("is_archived", false)
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecipeBrief[];
}

// Case-insensitive title search — "do we already have a sourdough?"
export async function findRecipesByTitle(
  supabase: SupabaseClient,
  householdId: string,
  query: string,
): Promise<RecipeBrief[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select("id,title,category")
    .eq("household_id", householdId)
    .ilike("title", `%${q}%`)
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecipeBrief[];
}

function normalizeMinutes(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Math.floor(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
