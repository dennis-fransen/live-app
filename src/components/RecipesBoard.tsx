"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchRecipes, RECIPE_CATEGORIES } from "@/lib/recipes";
import { RecipeCard } from "@/components/RecipeCard";
import type { RecipeWithDetails } from "@/lib/types";

export function RecipesBoard({ householdId }: { householdId: string }) {
  const supabaseRef = useRef(createClient());
  const [items, setItems] = useState<RecipeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Ignore realtime echoes of our own writes briefly, so an in-flight edit
  // isn't clobbered by the slower round-trip. Same pattern as the other boards.
  const suppressUntil = useRef(0);
  const suppress = useCallback((ms = 1500) => {
    suppressUntil.current = Date.now() + ms;
  }, []);

  const reload = useCallback(async () => {
    const rows = await fetchRecipes(supabaseRef.current, householdId);
    setItems(rows);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    reload();
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`recipes:${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipes", filter: `household_id=eq.${householdId}` },
        () => Date.now() > suppressUntil.current && reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipe_ingredients", filter: `household_id=eq.${householdId}` },
        () => Date.now() > suppressUntil.current && reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipe_steps", filter: `household_id=eq.${householdId}` },
        () => Date.now() > suppressUntil.current && reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, reload]);

  const active = items.filter((r) => !r.is_archived);
  const archived = items.filter((r) => r.is_archived);

  // Category chips are derived from what's actually in the box (plus current
  // filter, so a chip never vanishes under your finger).
  const categories = Array.from(
    new Set(active.map((r) => r.category).filter((c): c is string => !!c)),
  ).sort();

  const shown = filter ? active.filter((r) => r.category === filter) : active;

  const onChanged = useCallback(() => {
    suppress();
    reload();
  }, [suppress, reload]);

  if (loading) {
    return <p className="py-12 text-center text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <NewRecipeForm
        householdId={householdId}
        supabase={supabaseRef.current}
        onCreated={onChanged}
      />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip label="All" active={filter === null} onClick={() => setFilter(null)} />
          {categories.map((c) => (
            <FilterChip
              key={c}
              label={c}
              active={filter === c}
              onClick={() => setFilter(filter === c ? null : c)}
            />
          ))}
        </div>
      )}

      {active.length === 0 ? (
        <p className="py-10 text-center text-[var(--muted)]">
          No recipes yet — add the first thing you make. 🍞
        </p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-[var(--muted)]">
          Nothing in “{filter}” yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              supabase={supabaseRef.current}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
          >
            {showArchived ? "▾" : "▸"} Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-2">
              {archived.map((r) => (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  supabase={supabaseRef.current}
                  onChanged={onChanged}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-1 text-sm font-medium transition"
      style={{
        backgroundColor: active ? "var(--accent)" : "transparent",
        color: active ? "var(--bg)" : "var(--muted)",
        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
      }}
    >
      {label}
    </button>
  );
}

// Compact create form. Collapsed to a single button until you start adding.
// Just the header fields — ingredients and steps are added on the card once the
// recipe exists, mirroring how parts are added to a project.
function NewRecipeForm({
  householdId,
  supabase,
  onCreated,
}: {
  householdId: string;
  supabase: ReturnType<typeof createClient>;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [recipeYield, setRecipeYield] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = "card px-3 py-2 outline-none focus:border-[var(--accent)]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("recipes").insert({
      household_id: householdId,
      title: title.trim(),
      category: category.trim() || null,
      recipe_yield: recipeYield.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setCategory("");
    setRecipeYield("");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white"
      >
        ＋ New recipe
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-4">
      <h2 className="font-semibold">New recipe</h2>
      <input
        className={field}
        placeholder="e.g. Sourdough loaf"
        value={title}
        required
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Category
          <input
            className={field}
            list="recipe-categories"
            placeholder="Bread"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="recipe-categories">
            {RECIPE_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Yield
          <input
            className={field}
            placeholder="2 loaves"
            value={recipeYield}
            onChange={(e) => setRecipeYield(e.target.value)}
          />
        </label>
      </div>
      {error && <p className="text-sm text-[var(--overdue)]">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-2xl bg-[var(--accent)] px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add recipe"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-2xl px-4 py-3 font-medium text-[var(--muted)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
