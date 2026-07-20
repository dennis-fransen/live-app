import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Recipe,
  RecipeIngredient,
  RecipeStep,
  RecipeWithDetails,
} from "@/lib/types";

// Suggested categories for the recipe box — offered as a datalist, not
// enforced, so the household can type anything. Ordered by how we actually
// cook: the "make it ourselves" staples first.
export const RECIPE_CATEGORIES = [
  "Bread",
  "Jelly & preserves",
  "Breakfast",
  "Main",
  "Side",
  "Soup",
  "Baking & dessert",
  "Drinks",
  "Other",
] as const;

// Human-readable total time, e.g. "prep 20 min · bake 40 min". Omits parts
// that aren't set so a recipe with no times shows nothing.
export function formatTimes(
  prep: number | null,
  cook: number | null,
): string {
  const parts: string[] = [];
  if (prep != null) parts.push(`prep ${prep} min`);
  if (cook != null) parts.push(`cook ${cook} min`);
  return parts.join(" · ");
}

// One display string for an ingredient line: "500 g flour" / "flour".
export function ingredientLabel(
  ing: Pick<RecipeIngredient, "amount" | "name">,
): string {
  return [ing.amount?.trim(), ing.name.trim()].filter(Boolean).join(" ");
}

// All recipes for a household, each with its ingredients and steps, favorites
// first then alphabetical — a glanceable recipe box on the tablet.
export async function fetchRecipes(
  supabase: SupabaseClient,
  householdId: string,
): Promise<RecipeWithDetails[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id,household_id,title,description,category,recipe_yield,prep_minutes,cook_minutes,source,is_favorite,is_archived,created_at," +
        "ingredients:recipe_ingredients(id,household_id,recipe_id,amount,name,sort_order)," +
        "steps:recipe_steps(id,household_id,recipe_id,body,sort_order)",
    )
    .eq("household_id", householdId)
    .order("is_favorite", { ascending: false })
    .order("title", { ascending: true })
    .order("sort_order", { ascending: true, foreignTable: "recipe_ingredients" })
    .order("sort_order", { ascending: true, foreignTable: "recipe_steps" });

  if (error) throw error;

  return (data ?? []) as unknown as RecipeWithDetails[];
}

// Push a recipe's ingredients onto the shared shopping list. The recipe title
// rides along as the note ("for Sourdough") so a mixed list stays legible.
// Returns how many items were added.
export async function addIngredientsToShopping(
  supabase: SupabaseClient,
  recipe: Pick<Recipe, "household_id" | "title"> & {
    ingredients: RecipeIngredient[];
  },
): Promise<number> {
  const rows = recipe.ingredients.map((ing) => ({
    household_id: recipe.household_id,
    name: ing.name.trim(),
    note: ing.amount?.trim()
      ? `${ing.amount.trim()} · for ${recipe.title}`
      : `for ${recipe.title}`,
  }));
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("shopping_items").insert(rows);
  if (error) throw error;
  return rows.length;
}

// Convenience re-exports so callers can lean on one import.
export type { Recipe, RecipeIngredient, RecipeStep, RecipeWithDetails };
